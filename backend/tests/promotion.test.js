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

function makeItem({ product_id = 1, name, unit_price, quantity }) {
  return { product_id, quantity, unit_price, subtotal: unit_price * quantity, Product: { id: product_id, name } };
}

function mockModels({ sale, items = [] }) {
  getModels.mockReturnValue({
    Sale: { findByPk: jest.fn().mockResolvedValue(sale) },
    SaleItem: { findAll: jest.fn().mockResolvedValue(items) },
    Product: {}
  });
}

afterEach(() => jest.clearAllMocks());

// HU-06 — Promoción 2x1 Gelatinas: se aplica/quita sola, por cada par de
// unidades se descuenta el precio de una. No combina con descuento manual.
describe('sale.service — promoción 2x1 Gelatinas (_calcularPromo2x1)', () => {
  test('no aplica si no hay gelatinas en el carrito', () => {
    const items = [makeItem({ name: 'Papas', unit_price: 800, quantity: 4 })];
    expect(saleService._calcularPromo2x1(items)).toEqual({ activa: false, monto: 0 });
  });

  test('no aplica con una sola gelatina (hace falta el par)', () => {
    const items = [makeItem({ name: 'Gelatinas', unit_price: 500, quantity: 1 })];
    expect(saleService._calcularPromo2x1(items)).toEqual({ activa: false, monto: 0 });
  });

  test('2 gelatinas = 1 par → descuenta el precio de 1 unidad', () => {
    const items = [makeItem({ name: 'Gelatinas', unit_price: 500, quantity: 2 })];
    const result = saleService._calcularPromo2x1(items);
    expect(result).toEqual({ activa: true, monto: 500 });
  });

  test('4 gelatinas = 2 pares → descuenta el precio de 2 unidades', () => {
    const items = [makeItem({ name: 'Gelatinas', unit_price: 500, quantity: 4 })];
    const result = saleService._calcularPromo2x1(items);
    expect(result).toEqual({ activa: true, monto: 1000 });
  });

  test('3 gelatinas = 1 par (la tercera se cobra completa)', () => {
    const items = [makeItem({ name: 'Gelatinas', unit_price: 500, quantity: 3 })];
    const result = saleService._calcularPromo2x1(items);
    expect(result).toEqual({ activa: true, monto: 500 });
  });

  test('reconoce el producto sin importar mayúsculas o variantes del nombre', () => {
    const items = [makeItem({ name: 'GELATINA de fresa', unit_price: 500, quantity: 2 })];
    const result = saleService._calcularPromo2x1(items);
    expect(result.activa).toBe(true);
  });
});

describe('sale.service — recalculateSale() aplica/quita la promo sola', () => {
  test('se activa sola al llegar a 2 gelatinas', async () => {
    const sale = makeSale();
    mockModels({ sale, items: [makeItem({ name: 'Gelatinas', unit_price: 500, quantity: 2 })] });

    const result = await saleService.recalculateSale(1);

    expect(result.promotion).toBe('2x1');
    expect(result.discount).toBe(500);
  });

  test('se quita sola si se elimina una gelatina y ya no hay pares', async () => {
    const sale = makeSale({ promotion: '2x1' });
    mockModels({ sale, items: [makeItem({ name: 'Gelatinas', unit_price: 500, quantity: 1 })] });

    const result = await saleService.recalculateSale(1);

    expect(result.promotion).toBeNull();
    expect(result.discount).toBe(0);
  });

  test('NO se evalúa la 2x1 si ya hay un descuento manual activo (mutuamente excluyentes)', async () => {
    const sale = makeSale({ promotion: 'manual', discount_percentage: 10 });
    mockModels({
      sale,
      items: [
        makeItem({ product_id: 1, name: 'Gelatinas', unit_price: 500, quantity: 4 }), // calificaría para 2x1
        makeItem({ product_id: 2, name: 'Papas', unit_price: 4000, quantity: 1 }),
        makeItem({ product_id: 3, name: 'Coca Cola', unit_price: 4000, quantity: 1 })
      ]
    });

    const result = await saleService.recalculateSale(1);

    // se mantiene el descuento manual, la promo 2x1 nunca se evalúa
    expect(result.promotion).toBe('manual');
  });

  test('el total con la promo aplicada sigue siendo el precio ya con IVA, sin sumarlo aparte', async () => {
    const sale = makeSale();
    // 4 gelatinas @500 = 2000, promo descuenta 1000 → total esperado 1000
    mockModels({ sale, items: [makeItem({ name: 'Gelatinas', unit_price: 500, quantity: 4 })] });

    const result = await saleService.recalculateSale(1);

    expect(result.total).toBe(1000);
    expect(result.subtotal + result.tax).toBeCloseTo(result.total, 2);
  });
});
