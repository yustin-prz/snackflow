const express = require('express');
const router = express.Router();

const saleController = require('../controllers/sale.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

/**
 * @swagger
 * tags:
 *   name: Ventas
 *   description: Encabezado de la venta (el detalle de productos está en /api/sales/{saleId}/items)
 */

/**
 * @swagger
 * /api/sales:
 *   get:
 *     summary: Listar todas las ventas
 *     tags: [Ventas]
 *     responses:
 *       200:
 *         description: Lista de ventas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Sale'
 */
router.get('/', saleController.list);

/**
 * @swagger
 * /api/sales/{id}:
 *   get:
 *     summary: Obtener una venta por id, con su usuario y el detalle de productos
 *     tags: [Ventas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Venta encontrada
 *       404:
 *         description: Venta no encontrada
 */
router.get('/:id', saleController.getById);

/**
 * @swagger
 * /api/sales:
 *   post:
 *     summary: Crear una nueva venta (queda en estado "open", sin productos todavía)
 *     description: El usuario que la crea se toma del token, no hace falta (ni se puede) mandarlo en el body.
 *     tags: [Ventas]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customer_name:
 *                 type: string
 *               customer_phone:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Venta creada
 *       400:
 *         description: Datos inválidos
 */
router.post('/', saleController.create);

/**
 * @swagger
 * /api/sales/{id}/discount:
 *   post:
 *     summary: Aplicar un descuento manual a la venta (HU-05)
 *     description: >
 *       Requiere que la venta tenga al menos 3 productos diferentes y un total
 *       (con IVA incluido) de al menos ₡10,000. El porcentaje no puede superar
 *       el 10%. No se puede aplicar si la venta ya tiene otra promoción activa
 *       (ej. la 2x1 de Gelatina).
 *     tags: [Ventas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [percentage]
 *             properties:
 *               percentage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 10
 *     responses:
 *       200:
 *         description: Descuento aplicado, venta recalculada
 *       400:
 *         description: Venta no encontrada/cerrada, no cumple los requisitos, porcentaje inválido, o ya tiene otra promoción aplicada
 */
router.post('/:id/discount', saleController.applyDiscount);

/**
 * @swagger
 * /api/sales/{id}/discount:
 *   delete:
 *     summary: Quitar el descuento/promoción de la venta (HU-05)
 *     description: Si la venta califica para la 2x1 de Gelatina, se reactiva automáticamente al recalcular.
 *     tags: [Ventas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Descuento quitado, venta recalculada
 *       400:
 *         description: Venta no encontrada o ya cerrada
 */
router.delete('/:id/discount', saleController.removeDiscount);

/**
 * @swagger
 * /api/sales/{id}/complete:
 *   patch:
 *     summary: Cerrar la venta (fija el método de pago y pasa el estado a "completed")
 *     description: Requiere que la venta tenga al menos un producto agregado (ver /api/sales/{saleId}/items).
 *     tags: [Ventas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [payment_method]
 *             properties:
 *               payment_method:
 *                 type: string
 *                 enum: [cash, card]
 *     responses:
 *       200:
 *         description: Venta cerrada
 *       400:
 *         description: Venta no encontrada, ya cerrada, sin productos, o método de pago inválido
 */
router.patch('/:id/complete', saleController.complete);

module.exports = router;