jest.mock('../src/models');
jest.mock('../services/email.service');

const { getModels } = require('../src/models');
const emailService = require('../services/email.service');
const saleService = require('../services/sale.service');

// ---- helpers para simular instancias de Sequelize sin levantar una BD real ----
function makeSale(overrides = {}) {
  const sale = {
    id: 1,
    status: 'open',
    promotion: null,
    discount_percentage: null,
    customer_email: null,
    customer_name: null,
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    ...overrides
  };
  sale.update = jest.fn(async (fields) => {
    Object.assign(sale, fields);
    return sale;
  });
  return sale;
}

function makeItem({ product_id = 1, name = 'Producto', unit_price, quantity }) {
  return {
    product_id,
    quantity,
    unit_price,
    subtotal: unit_price * quantity,
    Product: { id: product_id, name }
  };
}

function mockModels({ sale, items = [] } = {}) {
  getModels.mockReturnValue({
    Sale: { findByPk: jest.fn().mockResolvedValue(sale), create: jest.fn() },
    SaleItem: { findAll: jest.fn().mockResolvedValue(items) },
    Product: {},
    User: {}
  });
}

afterEach(() => jest.clearAllMocks());

describe('sale.service — create()', () => {
  test('rechaza si no viene user_id', async () => {
    await expect(saleService.create({})).rejects.toThrow('El usuario es requerido.');
  });

  test('rechaza nombre de cliente con números', async () => {
    await expect(saleService.create({ user_id: 1, customer_name: 'Juan123' }))
      .rejects.toThrow('El nombre del cliente no puede tener números.');
  });

  test('rechaza correo con formato inválido', async () => {
    await expect(saleService.create({ user_id: 1, customer_email: 'no-es-un-correo' }))
      .rejects.toThrow('El correo electrónico no es válido.');
  });

  test('crea la venta en estado open cuando los datos son válidos', async () => {
    const created = { id: 42, status: 'open' };
    getModels.mockReturnValue({ Sale: { create: jest.fn().mockResolvedValue(created) } });

    const result = await saleService.create({ user_id: 1, customer_name: 'Juan Perez' });
    expect(result).toEqual({ id: 42, status: 'open' });
  });
});

describe('sale.service — recalculateSale() (IVA incluido en el precio)', () => {
  // Regla crítica: el precio del producto YA incluye el 13% de IVA. El total
  // cobrado es la suma de los productos tal cual (sin sumarle IVA aparte);
  // subtotal/tax son solo el desglose matemático de ese mismo total.
  test('el total es la suma de los items, no la suma + 13% extra', async () => {
    const sale = makeSale();
    mockModels({ sale, items: [makeItem({ unit_price: 800, quantity: 1 })] });

    const result = await saleService.recalculateSale(1);

    expect(result.total).toBe(800);      // NO 904 (800 * 1.13)
    expect(result.subtotal).toBeCloseTo(707.96, 2);
    expect(result.tax).toBeCloseTo(92.04, 2);
    expect(result.subtotal + result.tax).toBeCloseTo(result.total, 2);
  });

  test('sin descuento ni promo, discount queda en 0 y promotion en null', async () => {
    const sale = makeSale();
    mockModels({ sale, items: [makeItem({ unit_price: 500, quantity: 2 })] });

    const result = await saleService.recalculateSale(1);

    expect(result.discount).toBe(0);
    expect(result.promotion).toBeNull();
  });

  test('lanza error si la venta no existe', async () => {
    mockModels({ sale: null, items: [] });
    await expect(saleService.recalculateSale(999)).rejects.toThrow('Venta no encontrada.');
  });
});

describe('sale.service — complete()', () => {
  test('rechaza método de pago inválido', async () => {
    await expect(saleService.complete(1, 'bitcoin')).rejects.toThrow('El método de pago debe ser "cash" o "card".');
  });

  test('rechaza si la venta no existe', async () => {
    mockModels({ sale: null });
    await expect(saleService.complete(1, 'cash')).rejects.toThrow('Venta no encontrada.');
  });

  test('rechaza si la venta ya estaba cerrada', async () => {
    mockModels({ sale: makeSale({ status: 'completed' }) });
    await expect(saleService.complete(1, 'cash')).rejects.toThrow('La venta ya fue cerrada.');
  });

  test('rechaza cerrar una venta sin productos', async () => {
    mockModels({ sale: makeSale({ subtotal: 0 }) });
    await expect(saleService.complete(1, 'cash')).rejects.toThrow('No se puede cerrar una venta sin productos.');
  });

  test('cierra la venta y no intenta mandar factura si no hay customer_email', async () => {
    const sale = makeSale({ subtotal: 800, total: 800 });
    mockModels({ sale });

    const result = await saleService.complete(1, 'cash');

    expect(sale.status).toBe('completed');
    expect(sale.payment_method).toBe('cash');
    expect(result.invoiceEmailSent).toBe(false);
    expect(emailService.sendInvoice).not.toHaveBeenCalled();
  });

  test('manda la factura electrónica cuando hay customer_email, y no falla la venta si el correo falla', async () => {
    const sale = makeSale({ subtotal: 800, total: 800, customer_email: 'cliente@test.com' });
    getModels.mockReturnValue({
      Sale: {
        findByPk: jest.fn()
          .mockResolvedValueOnce(sale) // primer findByPk dentro de complete()
          .mockResolvedValueOnce({     // segundo findByPk dentro de getById()
            ...sale,
            User: { id: 1, full_name: 'Cajero Demo', username: 'cajero' },
            SaleItems: [{ id: 1, product_id: 1, quantity: 1, unit_price: 800, subtotal: 800, Product: { id: 1, name: 'Papas' } }]
          })
      }
    });
    emailService.sendInvoice.mockRejectedValueOnce(new Error('SMTP caído'));

    const result = await saleService.complete(1, 'cash');

    expect(sale.status).toBe('completed'); // la venta se cierra igual
    expect(result.invoiceEmailSent).toBe(false);
    expect(result.invoiceEmailError).toBe('SMTP caído');
  });
});
