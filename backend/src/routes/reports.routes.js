const express = require('express');
const router = express.Router();

const reportsController = require('../controllers/reports.controller');
const { verifyToken, verifyAdmin } = require('../middlewares/auth.middleware');

router.use(verifyToken, verifyAdmin);

/**
 * @swagger
 * tags:
 *   name: Reportes
 *   description: Reportes de ventas (solo administradores). Todos aceptan ?from=YYYY-MM-DD&to=YYYY-MM-DD (por defecto, últimos 30 días).
 */

/**
 * @swagger
 * /api/reports/by-transaction:
 *   get:
 *     summary: Listar las ventas completadas en el rango de fechas
 *     tags: [Reportes]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Lista de transacciones
 */
router.get('/by-transaction', reportsController.byTransaction);

/**
 * @swagger
 * /api/reports/by-product:
 *   get:
 *     summary: Productos vendidos en el rango, agregados por cantidad e ingresos
 *     tags: [Reportes]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Productos agregados, ordenados por ingresos descendente
 */
router.get('/by-product', reportsController.byProduct);

/**
 * @swagger
 * /api/reports/by-user:
 *   get:
 *     summary: Ventas del rango agregadas por cajero
 *     tags: [Reportes]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Ventas agregadas por cajero, ordenadas por ingresos descendente
 */
router.get('/by-user', reportsController.byUser);

/**
 * @swagger
 * /api/reports/export:
 *   get:
 *     summary: Descargar el reporte del rango como Excel (.xlsx) con formato de tabla
 *     description: Genera el archivo en el servidor con ExcelJS — encabezados con color de marca, filas en franjas, filtros y formato de moneda. La hoja "Transacciones" es una Tabla de Excel real, lista para armar una tabla dinámica (Insertar → Tabla dinámica).
 *     tags: [Reportes]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Archivo .xlsx
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/export', reportsController.exportExcel);

module.exports = router;
