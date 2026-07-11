const { Op } = require('sequelize');
const { getModels } = require('../src/models');

function parseDateRange(from, to) {
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);

  const start = from ? new Date(from) : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

class ReportService {

  // Lista de ventas completadas en el rango — base de la pestaña "Transacciones"
  // y de la hoja de detalle del Excel.
  async byTransaction(from, to) {
    const { Sale, User } = getModels();
    const { start, end } = parseDateRange(from, to);

    const sales = await Sale.findAll({
      where: { status: 'completed', created_at: { [Op.between]: [start, end] } },
      include: [{ model: User, attributes: ['id', 'full_name', 'username'] }],
      order: [['created_at', 'ASC']]
    });

    return sales.map(s => ({
      id: s.id,
      created_at: s.created_at,
      customer_name: s.customer_name,
      user: { id: s.User.id, full_name: s.User.full_name, username: s.User.username },
      payment_method: s.payment_method,
      subtotal: Number(s.subtotal),
      discount: Number(s.discount),
      tax: Number(s.tax),
      total: Number(s.total)
    }));
  }

  // Productos vendidos en el rango, agregados por cantidad e ingresos.
  async byProduct(from, to) {
    const { Sale, SaleItem, Product } = getModels();
    const { start, end } = parseDateRange(from, to);

    const sales = await Sale.findAll({
      where: { status: 'completed', created_at: { [Op.between]: [start, end] } },
      attributes: ['id']
    });
    const saleIds = sales.map(s => s.id);
    if (!saleIds.length) return [];

    const items = await SaleItem.findAll({
      where: { sale_id: saleIds },
      include: [{ model: Product, attributes: ['id', 'name'] }]
    });

    const grouped = {};
    for (const item of items) {
      const key = item.product_id;
      if (!grouped[key]) {
        grouped[key] = { product_id: key, product_name: item.Product.name, quantity: 0, subtotal: 0 };
      }
      grouped[key].quantity += item.quantity;
      grouped[key].subtotal += Number(item.subtotal);
    }

    return Object.values(grouped).sort((a, b) => b.subtotal - a.subtotal);
  }

  // Ventas del rango agregadas por cajero.
  async byUser(from, to) {
    const { Sale, User } = getModels();
    const { start, end } = parseDateRange(from, to);

    const sales = await Sale.findAll({
      where: { status: 'completed', created_at: { [Op.between]: [start, end] } },
      include: [{ model: User, attributes: ['id', 'full_name'] }]
    });

    const grouped = {};
    for (const sale of sales) {
      const key = sale.user_id;
      if (!grouped[key]) {
        grouped[key] = { user_id: key, full_name: sale.User.full_name, count: 0, total: 0 };
      }
      grouped[key].count += 1;
      grouped[key].total += Number(sale.total);
    }

    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }

}

module.exports = new ReportService();
