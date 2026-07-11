const { getModels } = require('../src/models');

const TAX_RATE = 0.13;

function round2(n) {
  return Math.round(n * 100) / 100;
}

class SaleService {

  async list() {
    const { Sale } = getModels();
    const sales = await Sale.findAll({ order: [['id', 'ASC']] });

    return sales.map(sale => ({
      id: sale.id,
      user_id: sale.user_id,
      customer_name: sale.customer_name,
      customer_phone: sale.customer_phone,
      notes: sale.notes,
      subtotal: sale.subtotal,
      discount: sale.discount,
      tax: sale.tax,
      total: sale.total,
      payment_method: sale.payment_method,
      status: sale.status,
      promotion: sale.promotion,
      created_at: sale.created_at
    }));
  }

  async getById(id) {
    const { Sale, User, SaleItem, Product } = getModels();

    const sale = await Sale.findByPk(id, {
      include: [
        { model: User },
        { model: SaleItem, include: [{ model: Product }] }
      ]
    });

    if (!sale) throw new Error('Venta no encontrada.');

    return {
      id: sale.id,
      user_id: sale.user_id,
      customer_name: sale.customer_name,
      customer_phone: sale.customer_phone,
      notes: sale.notes,
      subtotal: sale.subtotal,
      discount: sale.discount,
      tax: sale.tax,
      total: sale.total,
      payment_method: sale.payment_method,
      status: sale.status,
      promotion: sale.promotion,
      created_at: sale.created_at,
      user: {
        id: sale.User.id,
        full_name: sale.User.full_name,
        username: sale.User.username
      },
      items: sale.SaleItems.map(item => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        product: { id: item.Product.id, name: item.Product.name }
      }))
    };
  }

  // Crea el encabezado de la venta. user_id siempre viene del token (req.user.id en el
  // controller), nunca del body — para que un cajero no pueda crear ventas a nombre de otro.
  async create({ user_id, customer_name, customer_phone, notes }) {
    if (!user_id) throw new Error('El usuario es requerido.');

    const { Sale } = getModels();
    const sale = await Sale.create({
      user_id,
      customer_name: customer_name || null,
      customer_phone: customer_phone || null,
      notes: notes || null,
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      payment_method: null,
      status: 'open',
      promotion: null
    });

    return { id: sale.id, status: sale.status };
  }

  // Recalcula subtotal/impuesto/total a partir de los sale_items actuales.
  async recalculateSale(saleId) {
    const { Sale, SaleItem } = getModels();

    const sale = await Sale.findByPk(saleId);
    if (!sale) throw new Error('Venta no encontrada.');

    const items = await SaleItem.findAll({ where: { sale_id: saleId } });

    const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const discount = 0; // todavía no hay descuentos/promociones (HU-05/HU-06)
    const tax = round2((subtotal - discount) * TAX_RATE);
    const total = round2(subtotal - discount + tax);

    await sale.update({ subtotal: round2(subtotal), discount, tax, total });

    return { subtotal: round2(subtotal), discount, tax, total };
  }

  // Cierra la venta: fija el método de pago y pasa el estado a "completed".
  // Requiere que tenga al menos un producto agregado.
  async complete(saleId, paymentMethod) {
    if (!['cash', 'card'].includes(paymentMethod)) {
      throw new Error('El método de pago debe ser "cash" o "card".');
    }

    const { Sale } = getModels();
    const sale = await Sale.findByPk(saleId);
    if (!sale) throw new Error('Venta no encontrada.');
    if (sale.status !== 'open') throw new Error('La venta ya fue cerrada.');
    if (Number(sale.subtotal) <= 0) throw new Error('No se puede cerrar una venta sin productos.');

    await sale.update({ payment_method: paymentMethod, status: 'completed' });

    return {
      id: sale.id,
      status: sale.status,
      payment_method: sale.payment_method,
      subtotal: sale.subtotal,
      discount: sale.discount,
      tax: sale.tax,
      total: sale.total
    };
  }

}

module.exports = new SaleService();
