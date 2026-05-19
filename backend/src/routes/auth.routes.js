const express   = require('express');
const router    = express.Router();
const rateLimit = require('express-rate-limit');
const { login, setupTotp, verifyTotpAndReset } = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Demasiados intentos fallidos. Intentá de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { message: 'Demasiados intentos. Intentá de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * tags:
 *   name: Autenticación
 *   description: Endpoints de acceso al sistema
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Autenticación]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 example: admin123
 *               totpToken:
 *                 type: string
 *                 example: "123456"
 *                 description: Código de Google Authenticator (requerido si el usuario tiene 2FA activo)
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       202:
 *         description: Se requiere código de Google Authenticator
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requireTotp:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       401:
 *         description: Credenciales incorrectas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Demasiados intentos fallidos
 */
router.post('/login', loginLimiter, login);

/**
 * @swagger
 * /api/auth/setup-totp:
 *   post:
 *     summary: Configurar Google Authenticator
 *     tags: [Autenticación]
 *     description: Genera un QR para vincular Google Authenticator al usuario autenticado
 *     responses:
 *       200:
 *         description: QR generado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qrCode:
 *                   type: string
 *                   description: Imagen QR en base64
 *                 secret:
 *                   type: string
 *                   description: Clave secreta TOTP
 *       400:
 *         description: Error al generar el QR
 */
router.post('/setup-totp', verifyToken, setupTotp);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Recuperar contraseña con Google Authenticator
 *     tags: [Autenticación]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, token, newPassword]
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               token:
 *                 type: string
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 example: nuevaContrasena123
 *     responses:
 *       200:
 *         description: Contraseña actualizada correctamente
 *       400:
 *         description: Código incorrecto o datos inválidos
 *       429:
 *         description: Demasiados intentos
 */
router.post('/reset-password', resetLimiter, verifyTotpAndReset);

module.exports = router;