jest.mock('../src/models');
jest.mock('bcryptjs');
jest.mock('../services/totp.service');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getModels } = require('../src/models');
const totpService = require('../services/totp.service');
const authService = require('../services/auth.service');

process.env.JWT_SECRET = 'clave_de_prueba_para_tests_1234567890';

function makeUser(overrides = {}) {
  const user = {
    id: 1,
    username: 'cajero1',
    password: 'hash-guardado',
    full_name: 'Cajero de Prueba',
    role: 'cashier',
    active: true,
    must_change_password: false,
    totp_secret: null,
    totp_confirmed: false,
    totp_setup_deadline: null,
    ...overrides
  };
  user.update = jest.fn(async (fields) => { Object.assign(user, fields); return user; });
  return user;
}

function mockUser(user) {
  getModels.mockReturnValue({ User: { findOne: jest.fn().mockResolvedValue(user) } });
}

afterEach(() => jest.clearAllMocks());

describe('auth.service — login()', () => {
  test('rechaza usuario inexistente o inactivo', async () => {
    mockUser(null);
    await expect(authService.login('nadie', '123', null)).rejects.toThrow('Usuario o contraseña incorrectos.');
  });

  test('rechaza contraseña incorrecta', async () => {
    mockUser(makeUser());
    bcrypt.compare.mockResolvedValue(false);
    await expect(authService.login('cajero1', 'mal', null)).rejects.toThrow('Usuario o contraseña incorrectos.');
  });

  test('exige cambiar la contraseña temporal antes de continuar', async () => {
    mockUser(makeUser({ must_change_password: true }));
    bcrypt.compare.mockResolvedValue(true);

    await expect(authService.login('cajero1', 'temporal', null))
      .rejects.toMatchObject({ mustChangePassword: true });
  });

  test('sin 2FA configurado, entra directo con usuario y contraseña correctos', async () => {
    mockUser(makeUser({ totp_secret: null }));
    bcrypt.compare.mockResolvedValue(true);

    const result = await authService.login('cajero1', 'correcta', null);

    expect(result.token).toBeDefined();
    expect(result.user.username).toBe('cajero1');
    const decoded = jwt.verify(result.token, process.env.JWT_SECRET);
    expect(decoded.role).toBe('cashier');
  });

  test('con 2FA confirmado y sin código, pide el código (sin QR)', async () => {
    mockUser(makeUser({ totp_secret: 'SECRETO', totp_confirmed: true }));
    bcrypt.compare.mockResolvedValue(true);

    await expect(authService.login('cajero1', 'correcta', null)).rejects.toMatchObject({
      requireTotp: true,
      pendingSetup: false
    });
  });

  test('con 2FA pendiente de confirmar, pide el código y manda el QR', async () => {
    mockUser(makeUser({ totp_secret: 'SECRETO', totp_confirmed: false, totp_setup_deadline: new Date(Date.now() + 60000) }));
    bcrypt.compare.mockResolvedValue(true);
    totpService.buildOtpauthUrl.mockReturnValue('otpauth://...');
    totpService.generateQR.mockResolvedValue('data:image/png;base64,...');

    await expect(authService.login('cajero1', 'correcta', null)).rejects.toMatchObject({
      requireTotp: true,
      pendingSetup: true,
      qrCode: 'data:image/png;base64,...'
    });
  });

  test('rechaza código de Google Authenticator incorrecto', async () => {
    mockUser(makeUser({ totp_secret: 'SECRETO', totp_confirmed: true }));
    bcrypt.compare.mockResolvedValue(true);
    totpService.verifyToken.mockReturnValue(false);

    await expect(authService.login('cajero1', 'correcta', '000000'))
      .rejects.toThrow('Código de Google Authenticator incorrecto o expirado.');
  });

  test('entra con código correcto y confirma el 2FA la primera vez', async () => {
    const user = makeUser({ totp_secret: 'SECRETO', totp_confirmed: false, totp_setup_deadline: new Date(Date.now() + 60000) });
    mockUser(user);
    bcrypt.compare.mockResolvedValue(true);
    totpService.verifyToken.mockReturnValue(true);

    const result = await authService.login('cajero1', 'correcta', '123456');

    expect(result.token).toBeDefined();
    expect(user.totp_confirmed).toBe(true);
  });

  test('desactiva la cuenta sola si pasó el plazo de 24h sin confirmar el 2FA', async () => {
    const user = makeUser({
      totp_secret: 'SECRETO',
      totp_confirmed: false,
      totp_setup_deadline: new Date(Date.now() - 1000) // ya venció
    });
    mockUser(user);
    bcrypt.compare.mockResolvedValue(true);

    await expect(authService.login('cajero1', 'correcta', null)).rejects.toThrow(/desactivada/);
    expect(user.active).toBe(false);
  });
});

describe('auth.service — changeTempPassword()', () => {
  test('rechaza si las contraseñas nuevas no coinciden', async () => {
    await expect(authService.changeTempPassword('u', 'temp', 'nueva1', 'nueva2'))
      .rejects.toThrow('Las contraseñas nuevas no coinciden.');
  });

  test('rechaza contraseña nueva demasiado corta', async () => {
    await expect(authService.changeTempPassword('u', 'temp', '123', '123'))
      .rejects.toThrow('La contraseña debe tener al menos 6 caracteres.');
  });

  test('rechaza si el usuario no tenía contraseña temporal pendiente', async () => {
    mockUser(makeUser({ must_change_password: false }));
    await expect(authService.changeTempPassword('cajero1', 'temp', 'nuevaClave', 'nuevaClave'))
      .rejects.toThrow('Este usuario no tiene una contraseña temporal pendiente de cambio.');
  });

  test('cambia la contraseña y quita el flag must_change_password', async () => {
    const user = makeUser({ must_change_password: true });
    mockUser(user);
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('hash-nuevo');

    const result = await authService.changeTempPassword('cajero1', 'temporal', 'nuevaClave', 'nuevaClave');

    expect(user.must_change_password).toBe(false);
    expect(result.message).toMatch(/actualizada/);
  });
});

describe('auth.service — userExists() (paso 1 de "olvidé mi contraseña")', () => {
  test('devuelve exists:false si el usuario no existe', async () => {
    mockUser(null);
    const result = await authService.userExists('nadie');
    expect(result).toEqual({ exists: false });
  });

  test('devuelve exists:false si el usuario existe pero no tiene 2FA configurado', async () => {
    mockUser(makeUser({ totp_secret: null }));
    const result = await authService.userExists('cajero1');
    expect(result).toEqual({ exists: false });
  });

  test('devuelve exists:true si el usuario existe y tiene 2FA', async () => {
    mockUser(makeUser({ totp_secret: 'SECRETO' }));
    const result = await authService.userExists('cajero1');
    expect(result).toEqual({ exists: true });
  });
});
