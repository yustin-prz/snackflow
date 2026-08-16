const { getModels } = require('../src/models');
const emailService = require('./email.service');

const TAX_RATE = 0.13;

// Reglas de negocio de HU-05 (descuento manual) y HU-06 (promo 2x1 Gelatina).
// "Total de la venta" = suma de los productos, que ya incluyen el IVA.
const DISCOUNT_MAX_PERCENTAGE = 10;
const DISCOUNT_MIN_SALE_TOTAL = 10000;
const DISCOUNT_MIN_DISTINCT_PRODUCTS = 3;
const PROMO_2X1_PRODUCT_NAME = 'gelatina'; // coincide con "Gelatinas" u otra variante que contenga esta palabra

function round2(n) {
  return Math.round(n * 100) / 100;
}

// En Costa Rica no hay monedas más chicas que ₡5 — como los precios de
// producto ya son múltiplos de 5 (ver products.service.js), itemsTotal
// siempre lo es. Para que el total cobrado (itemsTotal - discount) se
// mantenga en un monto que de verdad se pueda cobrar/dar de vuelto en
// efectivo, el descuento en colones también se redondea a múltiplo de 5.
const COIN_BASE = 5;
function round5(n) {
  return Math.round(n / COIN_BASE) * COIN_BASE;
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
      customer_email: sale.customer_email,
      notes: sale.notes,
      subtotal: sale.subtotal,
      discount: sale.discount,
      discount_percentage: sale.discount_percentage,
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
      customer_email: sale.customer_email,
      notes: sale.notes,
      subtotal: sale.subtotal,
      discount: sale.discount,
      discount_percentage: sale.discount_percentage,
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
  async create({ user_id, customer_name, customer_phone, customer_email, notes }) {
    if (!user_id) throw new Error('El usuario es requerido.');

    // La validación del frontend (nuevaVenta.js) es solo para la experiencia
    // del cajero — la que cuenta de verdad es esta, igual que con el
    // descuento manual (ver applyDiscount).
    if (customer_name && /[0-9]/.test(customer_name)) {
      throw new Error('El nombre del cliente no puede tener números.');
    }
    if (customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
      throw new Error('El correo electrónico no es válido.');
    }

    const { Sale } = getModels();
    const sale = await Sale.create({
      user_id,
      customer_name: customer_name || null,
      customer_phone: customer_phone || null,
      customer_email: customer_email || null,
      notes: notes || null,
      subtotal: 0,
      discount: 0,
      discount_percentage: null,
      tax: 0,
      total: 0,
      payment_method: null,
      status: 'open',
      promotion: null
    });

    return { id: sale.id, status: sale.status };
  }

  // Calcula el descuento de la promo 2x1 de Gelatina a partir de los sale_items
  // actuales (con su Product ya incluido). Por cada par de unidades de
  // "Gelatina" se descuenta el precio de una unidad (ese precio ya incluye IVA,
  // igual que el resto de los montos de la venta).
  // Ej.: 4 gelatinas = 2 pares = se descuentan 2. 3 gelatinas = 1 par = se
  // descuenta 1 (la tercera se cobra completa).
  _calcularPromo2x1(items) {
    const gelatinaItem = items.find(
      i => i.Product && i.Product.name.trim().toLowerCase().includes(PROMO_2X1_PRODUCT_NAME)
    );

    if (!gelatinaItem || gelatinaItem.quantity < 2) {
      return { activa: false, monto: 0 };
    }

    const pares = Math.floor(gelatinaItem.quantity / 2);
    return { activa: true, monto: round2(pares * Number(gelatinaItem.unit_price)) };
  }

  // Recalcula subtotal/impuesto/total a partir de los sale_items actuales, y
  // mantiene coherente la promoción/descuento de la venta:
  //  - Si hay un descuento MANUAL activo, se vuelve a calcular su monto sobre
  //    el nuevo total de productos, o se quita solo si la venta dejó de
  //    cumplir los requisitos (menos de 3 productos distintos o total < ₡10,000).
  //  - Si no hay descuento manual, se evalúa la promo 2x1 de Gelatina y se
  //    aplica o se quita automáticamente según corresponda.
  // Ambas son mutuamente excluyentes: nunca se recalculan las dos a la vez.
  //
  // El precio de cada producto ya incluye el 13% de IVA, así que: primero se
  // calcula el total real a cobrar (suma de productos menos el descuento, todo
  // con IVA incluido), y recién de ese total final se desglosa el subtotal sin
  // IVA y el IVA para mostrarlos por separado.
  async recalculateSale(saleId) {
    const { Sale, SaleItem, Product } = getModels();

    const sale = await Sale.findByPk(saleId);
    if (!sale) throw new Error('Venta no encontrada.');

    const items = await SaleItem.findAll({
      where: { sale_id: saleId },
      include: [{ model: Product }]
    });

    const itemsTotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const distinctProducts = new Set(items.map(i => i.product_id)).size;

    let discount = 0;
    let promotion = sale.promotion;
    let discountPercentage = sale.discount_percentage;

    if (promotion === 'manual') {
      const eligible = distinctProducts >= DISCOUNT_MIN_DISTINCT_PRODUCTS && itemsTotal >= DISCOUNT_MIN_SALE_TOTAL;
      if (eligible && discountPercentage) {
        discount = round5(itemsTotal * (Number(discountPercentage) / 100));
      } else {
        promotion = null;
        discountPercentage = null;
        discount = 0;
      }
    } else {
      const promo2x1 = this._calcularPromo2x1(items);
      if (promo2x1.activa) {
        promotion = '2x1';
        discountPercentage = null;
        discount = promo2x1.monto;
      } else {
        promotion = null;
        discountPercentage = null;
        discount = 0;
      }
    }

    const total = round2(itemsTotal - discount);
    const subtotal = round2(total / (1 + TAX_RATE));
    const tax = round2(total - subtotal);

    await sale.update({
      subtotal,
      discount,
      discount_percentage: discountPercentage,
      promotion,
      tax,
      total
    });

    return { subtotal, discount, discount_percentage: discountPercentage, promotion, tax, total };
  }

  // Aplica un descuento manual (HU-05). Requiere al menos
  // DISCOUNT_MIN_DISTINCT_PRODUCTS productos diferentes y un total (con IVA
  // incluido) de al menos DISCOUNT_MIN_SALE_TOTAL, un porcentaje entre 0 y
  // DISCOUNT_MAX_PERCENTAGE, y que la venta no tenga ya otra promoción
  // aplicada (ej. la 2x1 automática).
  async applyDiscount(saleId, percentage) {
    const { Sale, SaleItem } = getModels();

    const sale = await Sale.findByPk(saleId);
    if (!sale) throw new Error('Venta no encontrada.');
    if (sale.status !== 'open') throw new Error('La venta ya fue cerrada.');

    if (sale.promotion) {
      throw new Error('Esta venta ya tiene una promoción aplicada; no se puede combinar con otro descuento.');
    }

    const pct = Number(percentage);
    if (!pct || pct <= 0) throw new Error('El porcentaje de descuento debe ser mayor que cero.');
    if (pct > DISCOUNT_MAX_PERCENTAGE) {
      throw new Error(`El descuento no puede superar el ${DISCOUNT_MAX_PERCENTAGE}% del total de la venta.`);
    }

    const items = await SaleItem.findAll({ where: { sale_id: saleId } });
    const distinctProducts = new Set(items.map(i => i.product_id)).size;
    const itemsTotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);

    if (distinctProducts < DISCOUNT_MIN_DISTINCT_PRODUCTS || itemsTotal < DISCOUNT_MIN_SALE_TOTAL) {
      throw new Error(
        `El descuento requiere al menos ${DISCOUNT_MIN_DISTINCT_PRODUCTS} productos diferentes y un total de al menos ₡${DISCOUNT_MIN_SALE_TOTAL.toLocaleString('es-CR')}.`
      );
    }

    const discount = round5(itemsTotal * (pct / 100));
    const total = round2(itemsTotal - discount);
    const subtotal = round2(total / (1 + TAX_RATE));
    const tax = round2(total - subtotal);

    await sale.update({
      discount,
      discount_percentage: pct,
      promotion: 'manual',
      subtotal,
      tax,
      total
    });

    return {
      id: sale.id,
      subtotal,
      discount,
      discount_percentage: pct,
      promotion: 'manual',
      tax,
      total
    };
  }

  // Quita el descuento/promoción de la venta y vuelve a calcularla desde
  // cero (lo que reactiva la 2x1 automática si el carrito califica para ella).
  async removeDiscount(saleId) {
    const { Sale } = getModels();

    const sale = await Sale.findByPk(saleId);
    if (!sale) throw new Error('Venta no encontrada.');
    if (sale.status !== 'open') throw new Error('La venta ya fue cerrada.');

    await sale.update({ promotion: null, discount_percentage: null });
    return this.recalculateSale(saleId);
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

    // Factura electrónica: si el cajero activó el toggle y capturó un correo,
    // se manda el resumen de la compra. La venta YA está cobrada y cerrada en
    // este punto, así que un fallo de correo (SMTP caído, correo inválido,
    // etc.) nunca debe deshacer la venta — solo se informa en la respuesta
    // para que el cajero sepa que tiene que avisarle al cliente a mano.
    let invoiceEmailSent = false;
    let invoiceEmailError = null;

    if (sale.customer_email) {
      try {
        const full = await this.getById(saleId);
        await emailService.sendInvoice(sale.customer_email, {
          saleId: full.id,
          customerName: full.customer_name,
          createdAt: full.created_at,
          paymentMethod: full.payment_method,
          cashierName: full.user.full_name,
          items: full.items.map(i => ({ product_name: i.product.name, quantity: i.quantity, unit_price: i.unit_price, subtotal: i.subtotal })),
          subtotal: full.subtotal,
          discount: full.discount,
          discountPercentage: full.discount_percentage,
          promotion: full.promotion,
          tax: full.tax,
          total: full.total
        });
        invoiceEmailSent = true;
      } catch (error) {
        invoiceEmailError = error.message;
      }
    }

    return {
      id: sale.id,
      status: sale.status,
      payment_method: sale.payment_method,
      subtotal: sale.subtotal,
      discount: sale.discount,
      discount_percentage: sale.discount_percentage,
      promotion: sale.promotion,
      tax: sale.tax,
      total: sale.total,
      invoiceEmailSent,
      invoiceEmailError
    };
  }

}

module.exports = new SaleService();