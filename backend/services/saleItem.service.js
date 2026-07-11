const { getModels } = require('../src/models');
const SaleService = require('./sale.service');


class SaleItemService {

    async listItems(saleId) {

        const { Sale, SaleItem, Product } = getModels();

        // Verificar que exista la venta
        const sale = await Sale.findByPk(saleId);

        if (!sale) {
            throw new Error("Venta no encontrada.");
        }

        // Obtener los productos de la venta
        const items = await SaleItem.findAll({
            where: {
                sale_id: saleId
            },
            include: [
                {
                    model: Product
                }
            ],
            order: [["id", "ASC"]]
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

    async addItem(pSaleId, pProductId, pQuantity) {

        const { Sale, Product, SaleItem } = getModels();

        const sale = await Sale.findByPk(pSaleId);

        if (!sale) {
            throw new Error("Venta no encontrada.");
        }

        if (sale.status !== "open") {
            throw new Error("La venta ya fue cerrada.");
        }

        const product = await Product.findByPk(pProductId);

        if (!product) {
            throw new Error("Producto no encontrado.");
        }

        if (!pQuantity || pQuantity <= 0) {
            throw new Error("La cantidad debe ser mayor que cero.");
        }

        const unitPrice = Number(product.price);

        let item = await SaleItem.findOne({
            where: {
                sale_id: pSaleId,
                product_id: pProductId
            }
        });

        if (item) {

            item.quantity += pQuantity;
            item.subtotal = item.quantity * Number(item.unit_price);

            await item.save();

        } else {

            item = await SaleItem.create({
                sale_id: pSaleId,
                product_id: pProductId,
                quantity: pQuantity,
                unit_price: unitPrice,
                subtotal: unitPrice * pQuantity
            });

        }

        await SaleService.recalculateSale(pSaleId);

        return {
            id: item.id,
            sale_id: item.sale_id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal
        };

    }
    async updateItem(pItemId, pQuantity) {

        const { SaleItem, Sale } = getModels();

        // Buscar el detalle
        const item = await SaleItem.findByPk(pItemId);

        if (!item) {
            throw new Error("Detalle de venta no encontrado.");
        }

        // Buscar la venta
        const sale = await Sale.findByPk(item.sale_id);

        if (!sale) {
            throw new Error("Venta no encontrada.");
        }

        // Verificar que siga abierta
        if (sale.status !== "open") {
            throw new Error("La venta ya fue cerrada.");
        }

        // Validar cantidad
        if (!pQuantity || pQuantity <= 0) {
            throw new Error("La cantidad debe ser mayor que cero.");
        }

        // Actualizar el detalle
        item.quantity = pQuantity;
        item.subtotal = pQuantity * Number(item.unit_price);

        await item.save();

        // Recalcular la factura
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

    async removeItem(pItemId) {

        const { SaleItem, Sale } = getModels();

        // Buscar el detalle
        const item = await SaleItem.findByPk(pItemId);

        if (!item) {
            throw new Error("Detalle de venta no encontrado.");
        }

        // Buscar la venta
        const sale = await Sale.findByPk(item.sale_id);

        if (!sale) {
            throw new Error("Venta no encontrada.");
        }

        // Verificar que siga abierta
        if (sale.status !== "open") {
            throw new Error("La venta ya fue cerrada.");
        }

        // Eliminar el detalle
        await item.destroy();

        // Recalcular la factura
        await SaleService.recalculateSale(item.sale_id);

        return {
            message: "Producto eliminado correctamente."
        };

    }
}

module.exports = new SaleItemService();