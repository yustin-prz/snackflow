const express = require('express');
const router = express.Router();

const saleItemController = require('../controllers/saleItem.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

/**
 * @swagger
 * /api/sales/{saleId}/items:
 *   get:
 *     summary: Obtener el detalle (productos) de una venta
 *     tags: [Ventas]
 *     parameters:
 *       - in: path
 *         name: saleId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalle de la venta
 *       404:
 *         description: Venta no encontrada
 */
router.get('/:saleId/items', saleItemController.listItems);

/**
 * @swagger
 * /api/sales/{saleId}/items:
 *   post:
 *     summary: Agregar un producto a la venta (si ya estaba, suma la cantidad)
 *     tags: [Ventas]
 *     parameters:
 *       - in: path
 *         name: saleId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product_id, quantity]
 *             properties:
 *               product_id:
 *                 type: integer
 *               quantity:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Producto agregado (recalcula automáticamente los totales de la venta)
 *       400:
 *         description: Venta cerrada, producto no encontrado/inactivo, o cantidad inválida
 */
router.post('/:saleId/items', saleItemController.addItem);

/**
 * @swagger
 * /api/sales/items/{itemId}:
 *   put:
 *     summary: Modificar la cantidad de un producto ya agregado
 *     tags: [Ventas]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Detalle actualizado
 *       400:
 *         description: Venta cerrada o cantidad inválida
 */
router.put('/items/:itemId', saleItemController.updateItem);

/**
 * @swagger
 * /api/sales/items/{itemId}:
 *   delete:
 *     summary: Quitar un producto de la venta
 *     tags: [Ventas]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Producto eliminado (recalcula los totales de la venta)
 *       400:
 *         description: Venta cerrada
 */
router.delete('/items/:itemId', saleItemController.removeItem);

module.exports = router;
