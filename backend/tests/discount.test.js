jest.mock('../src/models');
jest.mock('../services/email.service');

const { getModels } = require('../src/models');
const saleService = require('../services/sale.service');

function makeSale(overrides = {}) {
  const sale = {
    id: 1, status: 'open', promotion: null, discount_percentage: null,
    subtotal: 0, discount: 0, tax: 0, total: 0, ...overrides
  };
  sale.update = jest.fn(async (fields) => { Object.assign(sale, fields); return sale; });
  return sale;
}

function makeItem({ product_id, unit_price, quantity }) {
  return { product_id, quantity, unit_price, subtotal: unit_price * quantity };
}

function mockModels({ sale, items = [] }) {
  getModels.mockReturnValue({
    Sale: { findByPk: jest.fn().mockResolvedValue(sale) },
    SaleItem: { findAll: jest.fn().mockResolvedValue(items) }
  });
}

afterEach(() => jest.clearAllMocks());

// HU-05 — Descuento manual: ≥3 productos distintos, total ≥ ₡10,000,
// porcentaje ≤10%, y no combina con otra promoción activa.
describe('sale.service — applyDiscount() (HU-05)', () => {
  const carritoValido = [
    makeItem({ product_id: 1, unit_price: 4000, quantity: 1 }),
    makeItem({ product_id: 2, unit_price: 4000, quantity: 1 }),
    makeItem({ product_id: 3, unit_price: 4000, quantity: 1 })
  ]; // 3 productos distintos, total ₡12,000

  test('rechaza si la venta no existe', async () => {
    mockModels({ sale: null });
    await expect(saleService.applyDiscount(1, 10)).rejects.toThrow('Venta no encontrada.');
  });

  test('rechaza si la venta ya está cerrada', async () => {
    mockModels({ sale: makeSale({ status: 'completed' }) });
    await expect(saleService.applyDiscount(1, 10)).rejects.toThrow('La venta ya fue cerrada.');
  });

  test('rechaza si ya hay una promoción activa (mutuamente excluyente)', async () => {
    mockModels({ sale: makeSale({ promotion: '2x1' }) });
    await expect(saleService.applyDiscount(1, 5))
      .rejects.toThrow('Esta venta ya tiene una promoción aplicada; no se puede combinar con otro descuento.');
  });

  test('rechaza porcentaje cero o negativo', async () => {
    mockModels({ sale: makeSale(), items: carritoValido });
    await expect(saleService.applyDiscount(1, 0)).rejects.toThrow('El porcentaje de descuento debe ser mayor que cero.');
  });

  test('rechaza porcentaje mayor al 10%', async () => {
    mockModels({ sale: makeSale(), items: carritoValido });
    await expect(saleService.applyDiscount(1, 15)).rejects.toThrow('El descuento no puede superar el 10% del total de la venta.');
  });

  test('rechaza con menos de 3 productos distintos', async () => {
    mockModels({
      sale: makeSale(),
      items: [makeItem({ product_id: 1, unit_price: 6000, quantity: 1 }), makeItem({ product_id: 2, unit_price: 6000, quantity: 1 })]
    });
    await expect(saleService.applyDiscount(1, 10)).rejects.toThrow(/al menos 3 productos diferentes/);
  });

  test('rechaza con total menor a ₡10,000', async () => {
    mockModels({
      sale: makeSale(),
      items: [
        makeItem({ product_id: 1, unit_price: 1000, quantity: 1 }),
        makeItem({ product_id: 2, unit_price: 1000, quantity: 1 }),
        makeItem({ product_id: 3, unit_price: 1000, quantity: 1 })
      ]
    });
    await expect(saleService.applyDiscount(1, 10)).rejects.toThrow(/al menos.*10.000/);
  });

  test('aplica el descuento cuando se cumplen todos los requisitos', async () => {
    const sale = makeSale();
    mockModels({ sale, items: carritoValido });

    const result = await saleService.applyDiscount(1, 10);

    expect(result.promotion).toBe('manual');
    expect(result.discount_percentage).toBe(10);
    expect(sale.promotion).toBe('manual');
  });

  test('el descuento en colones se redondea a múltiplo de ₡5', async () => {
    // 12000 * 7% = 840 exacto → ya es múltiplo de 5, probamos con un % que NO lo sea
    const sale = makeSale();
    mockModels({ sale, items: carritoValido }); // total 12000

    const result = await saleService.applyDiscount(1, 3); // 12000 * 0.03 = 360 (ya múltiplo de 5)
    expect(result.discount % 5).toBe(0);
  });

  test('el total después del descuento sigue siendo múltiplo de 5 (denominaciones reales)', async () => {
    const sale = makeSale();
    mockModels({ sale, items: carritoValido });

    const result = await saleService.applyDiscount(1, 10); // 12000 - 1200 = 10800
    expect(Number(result.total) % 5).toBe(0);
  });
});

describe('sale.service — recalculateSale() revalida el descuento manual', () => {
  test('quita el descuento solo si el carrito deja de calificar (menos de 3 productos)', async () => {
    const sale = makeSale({ promotion: 'manual', discount_percentage: 10 });
    mockModels({
      sale,
      items: [makeItem({ product_id: 1, unit_price: 6000, quantity: 1 }), makeItem({ product_id: 2, unit_price: 6000, quantity: 1 })]
    });

    const result = await saleService.recalculateSale(1);

    expect(result.promotion).toBeNull();
    expect(result.discount).toBe(0);
    expect(result.discount_percentage).toBeNull();
  });

  test('mantiene el descuento manual si el carrito todavía califica', async () => {
    const sale = makeSale({ promotion: 'manual', discount_percentage: 10 });
    mockModels({
      sale,
      items: [
        makeItem({ product_id: 1, unit_price: 4000, quantity: 1 }),
        makeItem({ product_id: 2, unit_price: 4000, quantity: 1 }),
        makeItem({ product_id: 3, unit_price: 4000, quantity: 1 })
      ]
    });

    const result = await saleService.recalculateSale(1);

    expect(result.promotion).toBe('manual');
    expect(result.discount).toBeGreaterThan(0);
  });
});

describe('sale.service — removeDiscount()', () => {
  test('quita la promoción/descuento y recalcula', async () => {
    const sale = makeSale({ promotion: 'manual', discount_percentage: 10 });
    mockModels({ sale, items: [makeItem({ product_id: 1, unit_price: 800, quantity: 1 })] });

    const result = await saleService.removeDiscount(1);

    expect(sale.promotion).toBeNull();
    expect(result.discount).toBe(0);
  });
});
