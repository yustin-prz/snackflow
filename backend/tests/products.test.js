jest.mock('../src/models');

const { getModels } = require('../src/models');
const productsService = require('../services/products.service');

afterEach(() => jest.clearAllMocks());

// En Costa Rica no hay monedas más chicas que ₡5 — un precio de producto
// tiene que poder cobrarse/darse de vuelto en efectivo de verdad.
describe('products.service — denominaciones de moneda (₡5)', () => {
  test('rechaza un precio que no es múltiplo de 5 (ej. ₡121)', async () => {
    await expect(productsService.create({ name: 'Test', price: 121 }))
      .rejects.toThrow(/múltiplo de ₡5/);
  });

  test('rechaza otro no-múltiplo (ej. ₡2548)', async () => {
    await expect(productsService.create({ name: 'Test', price: 2548 }))
      .rejects.toThrow(/múltiplo de ₡5/);
  });

  test('rechaza precio negativo', async () => {
    await expect(productsService.create({ name: 'Test', price: -50 }))
      .rejects.toThrow('El precio debe ser un número válido mayor o igual a 0.');
  });

  test('acepta un múltiplo de 5 que no es múltiplo de 10 (25 + 10 = 35)', async () => {
    getModels.mockReturnValue({
      Product: { create: jest.fn().mockResolvedValue({ id: 1, name: 'Test', price: 35, active: true, image: null }) }
    });

    const result = await productsService.create({ name: 'Test', price: 35 });
    expect(result.price).toBe(35);
  });

  test('acepta precios "redondos" típicos del catálogo (₡800, ₡500, ₡1200)', async () => {
    getModels.mockReturnValue({
      Product: { create: jest.fn().mockImplementation(async (data) => ({ id: 1, ...data })) }
    });

    for (const price of [800, 500, 1200]) {
      const result = await productsService.create({ name: 'Papas', price });
      expect(result.price).toBe(price);
    }
  });

  test('update() valida el precio con la misma regla', async () => {
    const product = { id: 1, name: 'Papas', price: 800, active: true, image: null };
    product.update = jest.fn(async (fields) => Object.assign(product, fields));
    getModels.mockReturnValue({ Product: { findByPk: jest.fn().mockResolvedValue(product) } });

    await expect(productsService.update(1, { price: 799 })).rejects.toThrow(/múltiplo de ₡5/);
  });

  test('rechaza si falta el nombre o el precio', async () => {
    await expect(productsService.create({ price: 100 })).rejects.toThrow('El nombre y el precio son requeridos.');
    await expect(productsService.create({ name: 'Test' })).rejects.toThrow('El nombre y el precio son requeridos.');
  });
});

describe('products.service — remove()', () => {
  test('traduce el error de foreign key a un mensaje claro', async () => {
    const product = { id: 1, destroy: jest.fn().mockRejectedValue({ name: 'SequelizeForeignKeyConstraintError' }) };
    getModels.mockReturnValue({ Product: { findByPk: jest.fn().mockResolvedValue(product) } });

    await expect(productsService.remove(1)).rejects.toThrow('No se puede eliminar el producto: tiene ventas asociadas.');
  });

  test('rechaza si el producto no existe', async () => {
    getModels.mockReturnValue({ Product: { findByPk: jest.fn().mockResolvedValue(null) } });
    await expect(productsService.remove(999)).rejects.toThrow('Producto no encontrado.');
  });
});
