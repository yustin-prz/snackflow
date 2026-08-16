jest.mock('../src/models');
jest.mock('../services/email.service');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getModels } = require('../src/models');

process.env.JWT_SECRET = 'clave_de_prueba_para_tests_1234567890';
const app = require('../src/app');

function tokenPara(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

const cajero = { id: 7, username: 'cajero1', role: 'cashier', full_name: 'Cajero Demo' };

function makeSale(overrides = {}) {
  const sale = { id: 1, status: 'open', promotion: null, discount_percentage: null, subtotal: 0, discount: 0, tax: 0, total: 0, ...overrides };
  sale.update = jest.fn(async (fields) => Object.assign(sale, fields));
  return sale;
}

afterEach(() => jest.clearAllMocks());

describe('POST /api/sales', () => {
  test('rechaza sin token (401)', async () => {
    const res = await request(app).post('/api/sales').send({});
    expect(res.status).toBe(401);
  });

  // Regla de seguridad documentada: el user_id de la venta SIEMPRE sale del
  // token, nunca del body — para que un cajero no pueda registrar una venta
  // a nombre de otro usuario mandando un user_id distinto en el POST.
  test('usa el id del token para user_id, ignora cualquier user_id que venga en el body', async () => {
    const created = { id: 99, status: 'open' };
    const createMock = jest.fn().mockResolvedValue(created);
    getModels.mockReturnValue({ Sale: { create: createMock } });

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${tokenPara(cajero)}`)
      .send({ user_id: 999999, customer_name: 'Cliente Uno' }); // intento de suplantar a otro usuario

    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: cajero.id }));
  });

  test('400 si el nombre del cliente tiene números', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${tokenPara(cajero)}`)
      .send({ customer_name: 'Juan123' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/sales/:id', () => {
  test('404 si la venta no existe', async () => {
    getModels.mockReturnValue({ Sale: { findByPk: jest.fn().mockResolvedValue(null) } });

    const res = await request(app)
      .get('/api/sales/999')
      .set('Authorization', `Bearer ${tokenPara(cajero)}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/sales/:id/complete', () => {
  test('400 con método de pago inválido', async () => {
    const res = await request(app)
      .patch('/api/sales/1/complete')
      .set('Authorization', `Bearer ${tokenPara(cajero)}`)
      .send({ payment_method: 'bitcoin' });

    expect(res.status).toBe(400);
  });

  test('200 y cierra la venta con un método de pago válido', async () => {
    const sale = makeSale({ subtotal: 800, total: 800 });
    getModels.mockReturnValue({ Sale: { findByPk: jest.fn().mockResolvedValue(sale) } });

    const res = await request(app)
      .patch('/api/sales/1/complete')
      .set('Authorization', `Bearer ${tokenPara(cajero)}`)
      .send({ payment_method: 'cash' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });
});

describe('POST /api/sales/:id/discount (HU-05, a nivel HTTP)', () => {
  test('400 si el carrito no califica todavía', async () => {
    getModels.mockReturnValue({
      Sale: { findByPk: jest.fn().mockResolvedValue(makeSale()) },
      SaleItem: { findAll: jest.fn().mockResolvedValue([]) }
    });

    const res = await request(app)
      .post('/api/sales/1/discount')
      .set('Authorization', `Bearer ${tokenPara(cajero)}`)
      .send({ percentage: 10 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/al menos 3 productos/);
  });
});
