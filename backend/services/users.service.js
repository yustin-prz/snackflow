const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getModels } = require('../src/models');
const totpService = require('./totp.service');
const emailService = require('./email.service');

const publicAttrs = [
  'id', 'username', 'email', 'full_name', 'role', 'active',
  'totp_confirmed', 'totp_setup_deadline', 'must_change_password', 'created_at'
];
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOTP_SETUP_WINDOW_MS = 24 * 60 * 60 * 1000;
const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generateTempPassword(length = 10) {
  return Array.from(crypto.randomFillSync(new Uint8Array(length)))
    .map(byte => TEMP_PASSWORD_CHARS[byte % TEMP_PASSWORD_CHARS.length])
    .join('');
}

class UsersService {

  async list() {
    const { User } = getModels();
    return User.findAll({ attributes: publicAttrs, order: [['id', 'ASC']] });
  }

  async getById(id) {
    const { User } = getModels();
    const user = await User.findByPk(id, { attributes: publicAttrs });
    if (!user) throw new Error('Usuario no encontrado.');
    return user;
  }

  async create({ username, email, full_name, role }) {
    if (!username || !email || !full_name || !role)
      throw new Error('Todos los campos son requeridos.');
    if (!emailRegex.test(email))
      throw new Error('El correo electrónico no es válido.');
    if (!['admin', 'cashier'].includes(role))
      throw new Error('El rol debe ser "admin" o "cashier".');

    const { User } = getModels();
    const existing = await User.findOne({ where: { username } });
    if (existing) throw new Error('El nombre de usuario ya está en uso.');
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) throw new Error('El correo electrónico ya está en uso.');

    // Contraseña temporal: el admin nunca la define ni la ve, se genera al azar
    // y se envía por correo. El usuario está obligado a cambiarla en su primer login.
    const tempPassword = generateTempPassword();
    const hashed = await bcrypt.hash(tempPassword, 10);

    // El 2FA es obligatorio: se genera el secreto TOTP desde la creación del usuario.
    // Queda "pendiente" hasta el primer login exitoso con código válido, y tiene 24h para confirmarlo
    // (el conteo real empieza una vez que cambia la contraseña temporal).
    const { base32 } = totpService.generateSecret(username);
    const totp_setup_deadline = new Date(Date.now() + TOTP_SETUP_WINDOW_MS);

    const user = await User.create({
      username, email, password: hashed, full_name, role,
      totp_secret: base32, totp_confirmed: false, totp_setup_deadline,
      must_change_password: true
    });

    try {
      await emailService.sendTempPassword(email, { username, tempPassword, full_name });
    } catch (error) {
      await user.destroy();
      throw new Error(`No se pudo enviar el correo con la contraseña temporal (${error.message}). No se creó el usuario, revisá la configuración SMTP.`);
    }

    return {
      id: user.id, username: user.username, email: user.email,
      full_name: user.full_name, role: user.role, active: user.active,
      totp_confirmed: user.totp_confirmed, totp_setup_deadline: user.totp_setup_deadline,
      message: `Se envió un correo a ${email} con la contraseña temporal.`
    };
  }

  async update(id, { full_name, email, role, password }) {
    const { User } = getModels();
    const user = await User.findByPk(id);
    if (!user) throw new Error('Usuario no encontrado.');

    if (email !== undefined) {
      if (!emailRegex.test(email))
        throw new Error('El correo electrónico no es válido.');
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail && existingEmail.id !== user.id)
        throw new Error('El correo electrónico ya está en uso.');
    }
    if (role && !['admin', 'cashier'].includes(role))
      throw new Error('El rol debe ser "admin" o "cashier".');
    if (password && password.length < 6)
      throw new Error('La contraseña debe tener al menos 6 caracteres.');

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (password) updates.password = await bcrypt.hash(password, 10);

    await user.update(updates);

    return { id: user.id, username: user.username, email: user.email, full_name: user.full_name, role: user.role, active: user.active };
  }

  // Devuelve de nuevo el QR (a partir del secreto ya guardado) para usuarios que
  // todavía no confirmaron su 2FA, por si el admin necesita mostrárselo de nuevo.
  async getQr(id) {
    const { User } = getModels();
    const user = await User.findByPk(id);
    if (!user) throw new Error('Usuario no encontrado.');
    if (!user.totp_secret) throw new Error('Este usuario no tiene Google Authenticator configurado.');

    const otpauth_url = totpService.buildOtpauthUrl(user.username, user.totp_secret);
    const qrCode = await totpService.generateQR(otpauth_url);

    return {
      username: user.username, full_name: user.full_name,
      qrCode, secret: user.totp_secret,
      totp_confirmed: user.totp_confirmed, totp_setup_deadline: user.totp_setup_deadline
    };
  }

  // Activar/desactivar exige verificación con el código de Google Authenticator
  // del administrador que ejecuta la acción, y nunca sobre su propio usuario.
  async setActive(id, active, requestingAdminId, totpToken) {
    const { User } = getModels();
    const target = await User.findByPk(id);
    if (!target) throw new Error('Usuario no encontrado.');
    if (target.id === requestingAdminId)
      throw new Error('No podés cambiar el estado de tu propio usuario.');

    const admin = await User.findByPk(requestingAdminId);
    if (!admin.totp_secret)
      throw new Error('Necesitás configurar Google Authenticator en tu cuenta antes de realizar esta acción.');
    if (!totpToken)
      throw new Error('Se requiere el código de Google Authenticator.');
    const validTotp = totpService.verifyToken(admin.totp_secret, totpToken);
    if (!validTotp) throw new Error('Código de Google Authenticator incorrecto o expirado.');

    const updates = { active };
    // Al reactivar a alguien que nunca confirmó su 2FA, se le da una nueva ventana de 24h.
    if (active && !target.totp_confirmed && target.totp_secret) {
      updates.totp_setup_deadline = new Date(Date.now() + TOTP_SETUP_WINDOW_MS);
    }
    await target.update(updates);

    return {
      id: target.id, active: target.active,
      message: active ? 'Usuario activado correctamente.' : 'Usuario desactivado correctamente.'
    };
  }

}

module.exports = new UsersService();
