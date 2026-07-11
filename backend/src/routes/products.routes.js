const express = require('express');
const router = express.Router();
const { list, getById, getImage, create, update, remove } = require('../controllers/products.controller');
const { verifyToken, verifyAdmin } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Productos
 *   description: Catálogo de productos (lectura, alta y edición para cualquier usuario autenticado; eliminar es solo administradores)
 */

/**
 * @swagger
 * /api/products/{id}/image:
 *   get:
 *     summary: Obtener la imagen del producto como binario (decodificada del base64 guardado)
 *     description: Endpoint público (sin JWT) porque una etiqueta `<img>` no puede enviar el header Authorization.
 *     tags: [Productos]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Imagen del producto
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Producto no encontrado o sin imagen
 */
router.get('/:id/image', getImage);

router.use(verifyToken);

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Listar productos
 *     tags: [Productos]
 *     responses:
 *       200:
 *         description: Lista de productos (sin la imagen, solo un indicador hasImage)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 */
router.get('/', list);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Obtener un producto por id (incluye la imagen en base64 si tiene)
 *     tags: [Productos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Producto encontrado
 *       404:
 *         description: Producto no encontrado
 */
router.get('/:id', getById);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Crear un producto
 *     tags: [Productos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Papas
 *               price:
 *                 type: number
 *                 example: 800
 *               active:
 *                 type: boolean
 *               image:
 *                 type: string
 *                 description: Imagen en formato data URL base64 (data:image/png;base64,...)
 *     responses:
 *       201:
 *         description: Producto creado
 *       400:
 *         description: Datos inválidos
 */
router.post('/', create);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Actualizar un producto
 *     tags: [Productos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               active:
 *                 type: boolean
 *               image:
 *                 type: string
 *                 description: Data URL base64, o null para quitar la imagen actual
 *     responses:
 *       200:
 *         description: Producto actualizado
 *       400:
 *         description: Datos inválidos o producto no encontrado
 */
router.put('/:id', update);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Eliminar un producto (borrado físico, no lógico)
 *     tags: [Productos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Producto eliminado
 *       400:
 *         description: Producto no encontrado, o tiene ventas asociadas (no se puede eliminar)
 *       403:
 *         description: Se requiere rol administrador
 */
router.delete('/:id', verifyAdmin, remove);

module.exports = router;
