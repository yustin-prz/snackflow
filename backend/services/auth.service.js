const bcrypt      = require('bcryptjs');
const jwt         = require('jsonwebtoken');
const { User }    = require('../src/models');
const totpService = require('./totp.service');

class AuthService {

  async login(username, password, totpToken) {
    const user = await User.findOne({ where: { username, active: true } });
    if (!user) throw new Error('Usuario o contraseña incorrectos.');

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) throw new Error('Usuario o contraseña incorrectos.');

    // Si el usuario tiene TOTP configurado, verificar el código
    if (user.totp_secret) {
      if (!totpToken) {
        // Indicar al frontend que necesita el código TOTP
        const err = new Error('Se requiere código de Google Authenticator.');
        err.requireTotp = true;
        throw err;
      }
      const validTotp = totpService.verifyToken(user.totp_secret, totpToken);
      if (!validTotp) throw new Error('Código de Google Authenticator incorrecto o expirado.');
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return {
      token,
      user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role }
    };
  }

  async setupTotp(username) {
    const user = await User.findOne({ where: { username, active: true } });
    if (!user) throw new Error('Usuario no encontrado.');

    const { base32, otpauth_url } = totpService.generateSecret(username);
    const qrCode = await totpService.generateQR(otpauth_url);
    await user.update({ totp_secret: base32 });

    return { qrCode, secret: base32 };
  }

  async verifyTotpAndResetPassword(username, token, newPassword) {
    const user = await User.findOne({ where: { username, active: true } });
    if (!user) throw new Error('Usuario no encontrado.');
    if (!user.totp_secret) throw new Error('Este usuario no tiene Google Authenticator configurado.');

    const valid = totpService.verifyToken(user.totp_secret, token);
    if (!valid) throw new Error('Código incorrecto o expirado.');

    const hashed = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashed });

    return { message: 'Contraseña actualizada correctamente.' };
  }

}

module.exports = new AuthService();