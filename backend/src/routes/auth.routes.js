const express         = require('express');
const router          = express.Router();
const rateLimit       = require('express-rate-limit');
const { login }       = require('../controllers/auth.controller');

// Máximo 5 intentos de login por IP cada 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    message: 'Demasiados intentos fallidos. Intentá de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Solo cuenta intentos fallidos
});

router.post('/login', loginLimiter, login);

module.exports = router;