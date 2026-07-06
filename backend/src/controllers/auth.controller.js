const authService = require('../../services/auth.service');

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

module.exports = { login, changeTempPassword, setupTotp, verifyTotpAndReset };