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

router.post('/login',        loginLimiter, login);
router.post('/setup-totp',   verifyToken,  setupTotp);
router.post('/reset-password', resetLimiter, verifyTotpAndReset);

module.exports = router;