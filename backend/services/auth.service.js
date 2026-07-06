const bcrypt      = require('bcryptjs');
const jwt         = require('jsonwebtoken');
const { getModels } = require('../src/models');
const totpService = require('./totp.service');

class AuthService {

  async login(username, password, totpToken) {
    const { User } = getModels();
    const user = await User.findOne({ where: { username, active: true } });
    if (!user) throw new Error('Usuario o contraseña incorrectos.');

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) throw new Error('Usuario o contraseña incorrectos.');

    if (user.must_change_password) {
      const err = new Error('Tenés una contraseña temporal. Debés definir una nueva contraseña antes de continuar.');
      err.mustChangePassword = true;
      throw err;
    }

    if (user.totp_secret) {
      if (!user.totp_confirmed && user.totp_setup_deadline && new Date() > new Date(user.totp_setup_deadline)) {
        await user.update({ active: false });
        throw new Error('Tu cuenta fue desactivada por no configurar Google Authenticator dentro de las 24 horas. Contactá a un administrador para reactivarla.');
      }

      if (!totpToken) {
        const err = new Error(
          user.totp_confirmed
            ? 'Se requiere código de Google Authenticator.'
            : 'Escaneá el QR con Google Authenticator e ingresá el código para completar tu registro.'
        );
        err.requireTotp = true;
        err.pendingSetup = !user.totp_confirmed;
        err.deadline = user.totp_setup_deadline;
        if (!user.totp_confirmed) {
          const otpauth_url = totpService.buildOtpauthUrl(user.username, user.totp_secret);
          err.qrCode = await totpService.generateQR(otpauth_url);
          err.secret = user.totp_secret;
        }
        throw err;
      }
      const validTotp = totpService.verifyToken(user.totp_secret, totpToken);
      if (!validTotp) throw new Error('Código de Google Authenticator incorrecto o expirado.');

      if (!user.totp_confirmed) {
        await user.update({ totp_confirmed: true, totp_setup_deadline: null });
      }
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

  async changeTempPassword(username, tempPassword, newPassword, confirmPassword) {
    if (!username || !tempPassword || !newPassword || !confirmPassword)
      throw new Error('Todos los campos son requeridos.');
    if (newPassword !== confirmPassword)
      throw new Error('Las contraseñas nuevas no coinciden.');
    if (newPassword.length < 6)
      throw new Error('La contraseña debe tener al menos 6 caracteres.');

    const { User } = getModels();
    const user = await User.findOne({ where: { username, active: true } });
    if (!user) throw new Error('Usuario o contraseña incorrectos.');
    if (!user.must_change_password) throw new Error('Este usuario no tiene una contraseña temporal pendiente de cambio.');

    const validTemp = await bcrypt.compare(tempPassword, user.password);
    if (!validTemp) throw new Error('La contraseña temporal es incorrecta.');

    const hashed = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashed, must_change_password: false });

    return { message: 'Contraseña actualizada correctamente. Iniciá sesión con tu nueva contraseña.' };
  }

  async setupTotp(username) {
    const { User } = getModels();
    const user = await User.findOne({ where: { username, active: true } });
    if (!user) throw new Error('Usuario no encontrado.');

    const { base32, otpauth_url } = totpService.generateSecret(username);
    const qrCode = await totpService.generateQR(otpauth_url);
    await user.update({ totp_secret: base32 });

    return { qrCode, secret: base32 };
  }

  async verifyTotpAndResetPassword(username, token, newPassword) {
    const { User } = getModels();
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