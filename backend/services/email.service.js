const nodemailer = require('nodemailer');

class EmailService {

  getTransporter() {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('El envío de correo no está configurado. Definí SMTP_USER y SMTP_PASS en el .env.');
    }
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }

  async sendTempPassword(to, { username, tempPassword, full_name }) {
    const transporter = this.getTransporter();
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject: 'SnackFlow POS — Tu cuenta fue creada',
      html: `
        <p>Hola ${full_name},</p>
        <p>Se creó tu cuenta en <b>SnackFlow POS</b> (La Matamonchis S.A.).</p>
        <p><b>Usuario:</b> ${username}<br>
        <b>Contraseña temporal:</b> ${tempPassword}</p>
        <p>Al iniciar sesión por primera vez vas a tener que definir una contraseña nueva y
        configurar Google Authenticator (2FA) antes de poder usar el sistema.</p>
        <p>Este correo fue generado automáticamente, no respondas a esta dirección.</p>
      `
    });
  }

}

module.exports = new EmailService();
