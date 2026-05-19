const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { User } = require('../src/models');

class AuthService {

  async login(username, password) {
    // Buscar usuario activo
    const user = await User.findOne({
      where: { username, active: true }
    });

    if (!user) {
      throw new Error('Usuario o contraseña incorrectos.');
    }

    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new Error('Usuario o contraseña incorrectos.');
    }

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return {
      token,
      user: {
        id:        user.id,
        username:  user.username,
        full_name: user.full_name,
        role:      user.role
      }
    };
  }

}

module.exports = new AuthService();