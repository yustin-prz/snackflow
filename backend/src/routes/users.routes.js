const express = require('express');
const router = express.Router();
const { list, getById, create, update, setStatus, getQr } = require('../controllers/users.controller');
const { verifyToken, verifyAdmin } = require('../middlewares/auth.middleware');

router.use(verifyToken, verifyAdmin);

/**
 * @swagger
 * tags:
 *   name: Usuarios
 *   description: Gestión de usuarios del sistema (solo administradores)
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Listar usuarios
 *     tags: [Usuarios]
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       403:
 *         description: Se requiere rol administrador
 */
router.get('/', list);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Obtener un usuario por id
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Usuario encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/:id', getById);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Crear un usuario
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, full_name, role]
 *             properties:
 *               username:
 *                 type: string
 *                 example: cajero1
 *               email:
 *                 type: string
 *                 example: cajero1@lamatamonchis.com
 *               full_name:
 *                 type: string
 *                 example: Juan Pérez
 *               role:
 *                 type: string
 *                 enum: [admin, cashier]
 *                 example: cashier
 *     responses:
 *       201:
 *         description: Usuario creado. No se define contraseña aquí — se genera una contraseña temporal al azar y se envía por correo al usuario, que debe cambiarla en su primer login (junto con el 2FA, ambos obligatorios).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Datos inválidos, usuario/correo ya existente, o falló el envío del correo (SMTP mal configurado)
 */
router.post('/', create);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Actualizar un usuario
 *     tags: [Usuarios]
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
 *             properties:
 *               full_name:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, cashier]
 *               password:
 *                 type: string
 *                 description: Opcional, nueva contraseña
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Datos inválidos o usuario no encontrado
 */
router.put('/:id', update);

/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     summary: Activar o desactivar un usuario
 *     description: Requiere el código de Google Authenticator del administrador que ejecuta la acción. Nunca se puede aplicar sobre el propio usuario autenticado.
 *     tags: [Usuarios]
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
 *             required: [active, totpToken]
 *             properties:
 *               active:
 *                 type: boolean
 *               totpToken:
 *                 type: string
 *                 example: "123456"
 *                 description: Código de Google Authenticator del administrador
 *     responses:
 *       200:
 *         description: Estado actualizado
 *       400:
 *         description: Código incorrecto, usuario no encontrado o intento de cambiar el propio estado
 */
router.patch('/:id/status', setStatus);

/**
 * @swagger
 * /api/users/{id}/qr:
 *   get:
 *     summary: Volver a mostrar el QR de Google Authenticator de un usuario
 *     description: Útil cuando el 2FA todavía está pendiente de confirmar y hay que mostrárselo de nuevo al usuario.
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: QR regenerado
 *       400:
 *         description: Usuario no encontrado o sin 2FA configurado
 */
router.get('/:id/qr', getQr);

module.exports = router;
