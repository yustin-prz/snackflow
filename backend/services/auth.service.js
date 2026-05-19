const bcrypt      = require('bcryptjs');
const jwt         = require('jsonwebtoken');
const { User }    = require('../src/models');
const totpService = require('./totp.service');

/**
 * @class AuthService
 * @description Servicio de autenticación — maneja login, JWT y recuperación de contraseña.
 * Aplica Single Responsibility: solo gestiona autenticación.
 */
class AuthService {

  /**
   * Autentica un usuario con usuario, contraseña y opcionalmente código TOTP.
   * @param {string} username - Nombre de usuario
   * @param {string} password - Contraseña en texto plano
   * @param {string} [totpToken] - Código de 6 dígitos de Google Authenticator
   * @returns {Promise<{token: string, user: object}>} Token JWT y datos del usuario
   * @throws {Error} Si las credenciales son incorrectas o el código TOTP es inválido
   */
  async login(username, password, totpToken) {
    const user = await User.findOne({ where: { username, active: true } });
    if (!user) throw new Error('Usuario o contraseña incorrectos.');

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) throw new Error('Usuario o contraseña incorrectos.');

    if (user.totp_secret) {
      if (!totpToken) {
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

  /**
   * Genera un secreto TOTP y un QR para vincular Google Authenticator.
   * @param {string} username - Nombre de usuario
   * @returns {Promise<{qrCode: string, secret: string}>} QR en base64 y clave secreta
   * @throws {Error} Si el usuario no existe
   */
  async setupTotp(username) {
    const user = await User.findOne({ where: { username, active: true } });
    if (!user) throw new Error('Usuario no encontrado.');

    const { base32, otpauth_url } = totpService.generateSecret(username);
    const qrCode = await totpService.generateQR(otpauth_url);
    await user.update({ totp_secret: base32 });

    return { qrCode, secret: base32 };
  }

  /**
   * Verifica el código TOTP y actualiza la contraseña del usuario.
   * @param {string} username - Nombre de usuario
   * @param {string} token - Código TOTP de 6 dígitos
   * @param {string} newPassword - Nueva contraseña en texto plano
   * @returns {Promise<{message: string}>} Mensaje de confirmación
   * @throws {Error} Si el código es inválido o el usuario no tiene TOTP configurado
   */
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