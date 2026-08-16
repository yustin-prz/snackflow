const authService = require('../../services/auth.service');
const { isConnectionError, triggerFailoverNow } = require('../config/database');

const login = async (req, res) => {
  try {
    const { username, password, totpToken } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Usuario y contraseña son requeridos.' });

    const result = await authService.login(username, password, totpToken);
    res.json(result);
  } catch (error) {
    if (error.mustChangePassword) {
      return res.status(202).json({ mustChangePassword: true, message: error.message });
    }
    if (error.requireTotp) {
      return res.status(202).json({
        requireTotp: true,
        message: error.message,
        pendingSetup: !!error.pendingSetup,
        deadline: error.deadline || null,
        qrCode: error.qrCode || null,
        secret: error.secret || null
      });
    }
    // Un error de red hacia Neon (ej. se cayó el internet) NO es una
    // contraseña incorrecta — mostrar el error crudo (ENOTFOUND, etc.) como
    // si fuera 401 confundía al cajero y encima nunca disparaba el cambio a
    // Postgres local (eso solo pasaba en el próximo tick de startHealthCheck,
    // hasta 20s después). Acá se dispara el cambio YA y se le pide al
    // usuario que reintente en vez de mentirle sobre sus credenciales.
    if (isConnectionError(error)) {
      triggerFailoverNow();
      return res.status(503).json({
        message: 'Problema de conexión con la base de datos. Probá de nuevo en unos segundos — la app va a seguir funcionando sin internet.'
      });
    }
    res.status(401).json({ message: error.message });
  }
};

const changeTempPassword = async (req, res) => {
  try {
    const { username, tempPassword, newPassword, confirmPassword } = req.body;
    const result = await authService.changeTempPassword(username, tempPassword, newPassword, confirmPassword);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const checkUser = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username)
      return res.status(400).json({ message: 'El nombre de usuario es requerido.' });

    const result = await authService.userExists(username);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const setupTotp = async (req, res) => {
  try {
    const { username } = req.user;
    const result = await authService.setupTotp(username);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const verifyTotpAndReset = async (req, res) => {
  try {
    const { username, token, newPassword } = req.body;
    if (!username || !token || !newPassword)
      return res.status(400).json({ message: 'Todos los campos son requeridos.' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });

    const result = await authService.verifyTotpAndResetPassword(username, token, newPassword);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { login, changeTempPassword, checkUser, setupTotp, verifyTotpAndReset };