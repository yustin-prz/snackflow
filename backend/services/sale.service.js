const { getModels } = require('../src/models');

const TAX_RATE = 0.13;

class saleService {

async list() {

    const { Sale } = getModels();

    const sales = await Sale.findAll({
        order: [["id", "ASC"]]
    });

    return sales.map(sale => ({
        id: sale.id,
        user_id: sale.user_id,
        customer_name: sale.customer_name,
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
            {
                model: User
            },
            {
                model: SaleItem,
                include: [
                    {
                        model: Product
                    }
                ]
            }
        ]
    });

    if (!sale) {
        throw new Error("Venta no encontrada.");
    }

    return {
        id: sale.id,
        user_id: sale.user_id,
        customer_name: sale.customer_name,
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

            product: {
                id: item.Product.id,
                name: item.Product.name
            }
        }))
    };

}
   // Crea el encabezado de la factura/venta
async create({ user_id, customer_name }) {
    console.log("ENTRÓ AL CREATE");
    const { Sale } = getModels();

    if (!user_id) {
        throw new Error("El usuario es requerido.");
    }

    const sale = await Sale.create({
        user_id,
        customer_name: customer_name || null,
        subtotal: 0,
        discount: 0,
        tax: 0,
        total: 0,
        payment_method: null,
        status: "open",
        promotion: null
    });

    return {
        id: sale.id,
        status: sale.status
    };

}
    async recalculateSale(pSaleId) {

    const { Sale, SaleItem } = getModels();

    // Buscar la venta
    const sale = await Sale.findByPk(pSaleId);

    if (!sale) {
        throw new Error("Venta no encontrada.");
    }

    // Obtener todos los productos de la venta
    const items = await SaleItem.findAll({
        where: {
            sale_id: pSaleId
        }
    });

    // Calcular subtotal
    let subtotal = 0;

    for (const item of items) {
        subtotal += Number(item.subtotal);
    }

    // Por ahora no hay descuentos
    const discount = 0;

    // IVA 13%
    const tax = subtotal * TAX_RATE;

    // Total
    const total = subtotal - discount + tax;

    // Actualizar encabezado de la factura
    await sale.update({
        subtotal,
        discount,
        tax,
        total
    });

    return {
        subtotal,
        discount,
        tax,
        total
    };

}

}

module.exports = new saleService();