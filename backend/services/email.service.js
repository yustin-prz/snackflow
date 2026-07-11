const path = require('path');
const nodemailer = require('nodemailer');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'img', 'logo.png');
const BRAND_GRADIENT = 'linear-gradient(135deg, #FACF39, #f9c307)';
const TEXT_DARK = '#3a2c05';

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

    const html = `
    <div style="margin:0; padding:24px 12px; background:#f4f1e8; font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; margin:0 auto; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 4px 20px rgba(58,44,5,0.12);">

        <tr>
          <td style="background:${BRAND_GRADIENT}; padding:32px 24px; text-align:center;">
            <img src="cid:matamonchis-logo" alt="La Matamonchis" width="72" height="72" style="border-radius:50%; display:block; margin:0 auto 12px;">
            <p style="margin:0; font-size:20px; font-weight:700; color:${TEXT_DARK};">SnackFlow POS</p>
            <p style="margin:4px 0 0; font-size:13px; color:${TEXT_DARK}; opacity:0.85;">La Matamonchis S.A.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 28px;">
            <p style="margin:0 0 16px; font-size:15px; color:#2b2b2b;">Hola <b>${full_name}</b>,</p>
            <p style="margin:0 0 24px; font-size:14px; line-height:1.6; color:#555;">
              Se creó tu cuenta en el sistema de punto de venta de <b>La Matamonchis</b>.
              Usá las siguientes credenciales para iniciar sesión por primera vez:
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f3; border:1px solid #ece7d8; border-radius:10px; margin-bottom:24px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 4px; font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#8a8577;">Usuario</p>
                  <p style="margin:0 0 14px; font-size:16px; font-weight:600; color:#2b2b2b; font-family:Consolas,Menlo,monospace;">${username}</p>
                  <p style="margin:0 0 4px; font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#8a8577;">Contraseña temporal</p>
                  <p style="margin:0; font-size:16px; font-weight:600; color:#2b2b2b; font-family:Consolas,Menlo,monospace;">${tempPassword}</p>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FEF3C7; border-radius:10px; margin-bottom:24px;">
              <tr>
                <td style="padding:14px 18px; font-size:13px; line-height:1.6; color:#92400E;">
                  <b>Antes de poder usar el sistema</b> vas a tener que: definir una contraseña nueva propia, y
                  escanear un código QR con Google Authenticator para activar la verificación en dos pasos (2FA).
                  Ambos pasos aparecen automáticamente en tu primer inicio de sesión.
                </td>
              </tr>
            </table>

            <p style="margin:0 0 4px; font-size:12px; color:#aaa; text-align:center;">
              Este correo fue generado automáticamente. Si vos no solicitaste esta cuenta, contactá a un administrador.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:18px 24px; background:#faf8f3; text-align:center; border-top:1px solid #ece7d8;">
            <p style="margin:0; font-size:11px; color:#8a8577;">SnackFlow POS · La Matamonchis S.A.</p>
          </td>
        </tr>

      </table>
    </div>`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject: 'Tu cuenta en SnackFlow POS — La Matamonchis',
      html,
      attachments: [
        { filename: 'logo.png', path: LOGO_PATH, cid: 'matamonchis-logo' }
      ]
    });
  }

}

module.exports = new EmailService();
