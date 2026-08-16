const express   = require('express');
const router    = express.Router();
const rateLimit = require('express-rate-limit');
const { login, changeTempPassword, checkUser, setupTotp, verifyTotpAndReset } = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// Antes esto limitaba por IP sola: en un local con un solo router/wifi
// (o varias cajas en la misma red), todos los cajeros comparten la misma IP
// vista por el servidor, así que 5 intentos fallidos de UN usuario bloqueaba
// el login de TODOS los demás durante 15 minutos. La clave ahora es
// IP + usuario, para que el límite sea "este usuario, desde esta red", no
// "cualquiera desde esta red". La IP se mantiene en la clave para que
// alguien no evada el límite simplemente probando muchos usuarios distintos.
const porIpYUsuario = (req) => `${req.ip}:${(req.body && req.body.username) || 'sin-usuario'}`;

// Un 503 (Neon caído, ver auth.controller.js) NO es un intento fallido de
// login — es un problema de conexión ajeno a la contraseña. Sin esto, cada
// request que chocaba con Neon offline gastaba una de las 5 oportunidades
// igual que una contraseña incorrecta, y unos pocos reintentos durante un
// corte de internet bastaban para autobloquearse 15 minutos justo cuando
// más se necesitaba poder entrar por Postgres local.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Demasiados intentos fallidos. Intentá de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode < 400 || res.statusCode === 503,
  keyGenerator: porIpYUsuario
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { message: 'Demasiados intentos. Intentá de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: porIpYUsuario
});

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Demasiados intentos. Intentá de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: porIpYUsuario
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
 * /api/auth/check-user:
 *   post:
 *     summary: Verificar si un nombre de usuario existe (paso 1 de recuperar contraseña)
 *     tags: [Autenticación]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username]
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *     responses:
 *       200:
 *         description: Indica si el usuario existe
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *       429:
 *         description: Demasiados intentos
 */
router.post('/check-user', resetLimiter, checkUser);

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

/**
 * @swagger
 * /api/auth/change-temp-password:
 *   post:
 *     summary: Cambiar la contraseña temporal en el primer login
 *     tags: [Autenticación]
 *     security: []
 *     description: Se usa cuando el login responde `{mustChangePassword true}`. Requiere la contraseña temporal para confirmar identidad.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, tempPassword, newPassword, confirmPassword]
 *             properties:
 *               username:
 *                 type: string
 *                 example: cajero1
 *               tempPassword:
 *                 type: string
 *                 description: Contraseña temporal recibida por correo
 *               newPassword:
 *                 type: string
 *                 example: miContrasenaNueva123
 *               confirmPassword:
 *                 type: string
 *                 example: miContrasenaNueva123
 *     responses:
 *       200:
 *         description: Contraseña actualizada correctamente
 *       400:
 *         description: Contraseñas no coinciden, contraseña temporal incorrecta, o datos inválidos
 *       429:
 *         description: Demasiados intentos
 */
router.post('/change-temp-password', changePasswordLimiter, changeTempPassword);

module.exports = router;