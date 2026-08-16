// Pruebas de integración (Supertest): ejercitan la app de Express real
// (rutas → middlewares → controllers → servicio), pero con getModels()
// mockeado en vez de una base de datos real — mismo criterio que los tests
// unitarios, aplicado ahora a nivel HTTP.
jest.mock('../src/models');
jest.mock('bcryptjs');

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { getModels } = require('../src/models');

process.env.JWT_SECRET = 'clave_de_prueba_para_tests_1234567890';
const app = require('../src/app');

function makeUser(overrides = {}) {
  const user = {
    id: 1, username: 'cajero1', password: 'hash', full_name: 'Cajero Demo',
    role: 'cashier', active: true, must_change_password: false, totp_secret: null,
    totp_confirmed: false, totp_setup_deadline: null,
    ...overrides
  };
  user.update = jest.fn(async (fields) => Object.assign(user, fields));
  return user;
}

function mockUser(user) {
  getModels.mockReturnValue({ User: { findOne: jest.fn().mockResolvedValue(user) } });
}

afterEach(() => jest.clearAllMocks());

describe('POST /api/auth/login', () => {
  test('400 si faltan usuario o contraseña', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'x' });
    expect(res.status).toBe(400);
  });

  test('401 con contraseña incorrecta', async () => {
    mockUser(makeUser());
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app).post('/api/auth/login').send({ username: 'cajero1', password: 'mal' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/incorrectos/);
  });

  test('200 con credenciales correctas y sin 2FA configurado', async () => {
    mockUser(makeUser({ totp_secret: null }));
    bcrypt.compare.mockResolvedValue(true);

    const res = await request(app).post('/api/auth/login').send({ username: 'cajero1', password: 'ok' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('cajero1');
  });

  test('202 pidiendo el código de 2FA cuando el usuario ya lo tiene confirmado', async () => {
    mockUser(makeUser({ totp_secret: 'SECRETO', totp_confirmed: true }));
    bcrypt.compare.mockResolvedValue(true);

    const res = await request(app).post('/api/auth/login').send({ username: 'cajero1', password: 'ok' });

    expect(res.status).toBe(202);
    expect(res.body.requireTotp).toBe(true);
  });
});

// El bug real que motivó esto: el rate limit contaba por IP sola, así que 5
// intentos fallidos de un cajero bloqueaba a CUALQUIER otro usuario que
// intentara entrar desde la misma red. Ahora la clave es IP + usuario.
describe('POST /api/auth/login — rate limiting por usuario, no por IP', () => {
  test('bloquea con 429 al 6to intento fallido del MISMO usuario', async () => {
    mockUser(makeUser());
    bcrypt.compare.mockResolvedValue(false);

    let lastStatus;
    for (let i = 0; i < 6; i++) {
      const res = await request(app).post('/api/auth/login').send({ username: 'usuario-rl-1', password: 'mal' });
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });

  test('un usuario DISTINTO, desde la misma IP de test, no queda bloqueado', async () => {
    mockUser(makeUser());
    bcrypt.compare.mockResolvedValue(false);

    // agota el límite para "usuario-rl-2"
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ username: 'usuario-rl-2', password: 'mal' });
    }
    const bloqueado = await request(app).post('/api/auth/login').send({ username: 'usuario-rl-2', password: 'mal' });
    expect(bloqueado.status).toBe(429);

    // "usuario-rl-3" nunca intentó antes — no debería estar bloqueado
    const otroUsuario = await request(app).post('/api/auth/login').send({ username: 'usuario-rl-3', password: 'mal' });
    expect(otroUsuario.status).toBe(401); // credenciales incorrectas, pero NO 429
  });
});

describe('POST /api/auth/check-user', () => {
  test('exists:false si el usuario no existe', async () => {
    mockUser(null);
    const res = await request(app).post('/api/auth/check-user').send({ username: 'nadie-' + Date.now() });
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(false);
  });

  test('exists:true si el usuario existe y tiene 2FA', async () => {
    mockUser(makeUser({ totp_secret: 'SECRETO' }));
    const res = await request(app).post('/api/auth/check-user').send({ username: 'con-2fa-' + Date.now() });
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
  });
});

describe('Middleware de autenticación (verifyToken) sobre una ruta protegida', () => {
  test('401 sin token', async () => {
    const res = await request(app).get('/api/sales');
    expect(res.status).toBe(401);
  });

  test('401 con un token inválido', async () => {
    const res = await request(app).get('/api/sales').set('Authorization', 'Bearer token-invalido');
    expect(res.status).toBe(401);
  });
});
