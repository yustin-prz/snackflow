const authService = require('../../services/auth.service');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña son requeridos.' });
    }

    const result = await authService.login(username, password);
    res.json(result);

  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

module.exports = { login };