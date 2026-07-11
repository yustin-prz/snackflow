const { getModels } = require('../src/models');
const SaleService = require('./sale.service');

class SaleItemService {

  async listItems(saleId) {
    const { Sale, SaleItem, Product } = getModels();

    const sale = await Sale.findByPk(saleId);
    if (!sale) throw new Error('Venta no encontrada.');

    const items = await SaleItem.findAll({
      where: { sale_id: saleId },
      include: [{ model: Product }],
      order: [['id', 'ASC']]
    });

    return items.map(item => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.Product.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal
    }));
  }

  async addItem(saleId, productId, quantity) {
    const { Sale, Product, SaleItem } = getModels();

    const sale = await Sale.findByPk(saleId);
    if (!sale) throw new Error('Venta no encontrada.');
    if (sale.status !== 'open') throw new Error('La venta ya fue cerrada.');

    const product = await Product.findByPk(productId);
    if (!product) throw new Error('Producto no encontrado.');
    if (!product.active) throw new Error('Este producto no está disponible para la venta.');

    if (!quantity || quantity <= 0) throw new Error('La cantidad debe ser mayor que cero.');

    const unitPrice = Number(product.price);

    let item = await SaleItem.findOne({ where: { sale_id: saleId, product_id: productId } });

    if (item) {
      item.quantity += quantity;
      item.subtotal = item.quantity * Number(item.unit_price);
      await item.save();
    } else {
      item = await SaleItem.create({
        sale_id: saleId,
        product_id: productId,
        quantity,
        unit_price: unitPrice,
        subtotal: unitPrice * quantity
      });
    }

    await SaleService.recalculateSale(saleId);

    return {
      id: item.id,
      sale_id: item.sale_id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal
    };
  }

  async updateItem(itemId, quantity) {
    const { SaleItem, Sale } = getModels();

    const item = await SaleItem.findByPk(itemId);
    if (!item) throw new Error('Detalle de venta no encontrado.');

    const sale = await Sale.findByPk(item.sale_id);
    if (!sale) throw new Error('Venta no encontrada.');
    if (sale.status !== 'open') throw new Error('La venta ya fue cerrada.');

    if (!quantity || quantity <= 0) throw new Error('La cantidad debe ser mayor que cero.');

    item.quantity = quantity;
    item.subtotal = quantity * Number(item.unit_price);
    await item.save();

    await SaleService.recalculateSale(item.sale_id);

    return {
      id: item.id,
      sale_id: item.sale_id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal
    };
  }

  async removeItem(itemId) {
    const { SaleItem, Sale } = getModels();

    const item = await SaleItem.findByPk(itemId);
    if (!item) throw new Error('Detalle de venta no encontrado.');

    const sale = await Sale.findByPk(item.sale_id);
    if (!sale) throw new Error('Venta no encontrada.');
    if (sale.status !== 'open') throw new Error('La venta ya fue cerrada.');

    const saleId = item.sale_id;
    await item.destroy();
    await SaleService.recalculateSale(saleId);

    return { message: 'Producto eliminado correctamente.' };
  }

}

module.exports = new SaleItemService();
