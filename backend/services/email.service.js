const path = require('path');
const nodemailer = require('nodemailer');
const { buildInvoicePdfBuffer } = require('./invoicePdf.service');
const { buildInvoiceXml } = require('./invoiceXml.service');

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

  // Factura electrónica (resumen de compra) que se manda al cliente cuando
  // el cajero activa el toggle de "Factura electrónica" en Nueva venta y
  // completa el pago. A diferencia de sendTempPassword, un fallo acá NUNCA
  // debe revertir nada — la venta ya se cobró — así que quien llama a esto
  // (sale.service.js) lo hace en un try/catch aparte y solo registra el error.
  async sendInvoice(to, { saleId, customerName, createdAt, paymentMethod, cashierName, items, subtotal, discount, discountPercentage, promotion, tax, total }) {
    const transporter = this.getTransporter();

    const money = (n) => '₡' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // El contenedor corre en UTC, no en hora de Costa Rica — sin timeZone acá,
    // la fecha se formatea 6 horas adelantada (a un cliente que compró a las
    // 7:01am le llegaba la factura diciendo la 1:01pm).
    const fecha = new Date(createdAt).toLocaleString('es-CR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Costa_Rica' });
    const metodoPago = paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta';
    const nombre = customerName || 'Cliente';

    const filasItems = items.map(item => `
      <tr>
        <td style="padding:10px;text-align:left;border-bottom:1px solid #ece7d8;font-size:13px;color:#2b2b2b;">${item.product_name}</td>
        <td style="padding:10px;text-align:right;border-bottom:1px solid #ece7d8;font-size:13px;color:#555;">${money(item.unit_price)}</td>
        <td style="padding:10px;text-align:right;border-bottom:1px solid #ece7d8;font-size:13px;color:#555;">${item.quantity}</td>
        <td style="padding:10px;text-align:right;border-bottom:1px solid #ece7d8;font-size:13px;color:#2b2b2b;font-weight:600;">${money(item.subtotal)}</td>
      </tr>
    `).join('');

    const etiquetaDescuento = promotion === '2x1' ? 'Promoción 2x1 Gelatina' : `Descuento (${discountPercentage}%)`;
    const filaDescuento = Number(discount) > 0 ? `
      <tr>
        <td style="text-align:right;padding:5px 10px 0 0;font-size:13px;color:#555;">${etiquetaDescuento}</td>
        <td style="text-align:right;padding:5px 10px 0 0;font-size:13px;color:#c62828;width:120px;">-${money(discount)}</td>
      </tr>` : '';

    const html = `
    <div style="margin:0; padding:24px 12px; background:#f4f1e8; font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 4px 20px rgba(58,44,5,0.12);">

        <tr>
          <td style="background:${BRAND_GRADIENT}; padding:32px 24px; text-align:center;">
            <img src="cid:matamonchis-logo" alt="La Matamonchis" width="64" height="64" style="border-radius:50%; display:block; margin:0 auto 12px;">
            <p style="margin:0; font-size:20px; font-weight:700; color:${TEXT_DARK};">SnackFlow POS</p>
            <p style="margin:4px 0 0; font-size:13px; color:${TEXT_DARK}; opacity:0.85;">La Matamonchis S.A.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 28px 8px;">
            <p style="margin:0 0 4px; font-size:13px; color:#8a8577;">Hola ${nombre},</p>
            <p style="margin:0; font-size:32px; line-height:1.2; font-weight:800; color:#2b2b2b;">Gracias por tu compra — ${money(total)}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:0 0 16px; width:50%; vertical-align:top;">
                  <p style="margin:0 0 4px; font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#8a8577;">Nº de venta</p>
                  <p style="margin:0; font-size:14px; color:#2b2b2b;">#${saleId}</p>
                </td>
                <td style="padding:0 0 16px; width:50%; vertical-align:top;">
                  <p style="margin:0 0 4px; font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#8a8577;">Fecha</p>
                  <p style="margin:0; font-size:14px; color:#2b2b2b;">${fecha}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 0 4px; width:50%; vertical-align:top;">
                  <p style="margin:0 0 4px; font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#8a8577;">Atendido por</p>
                  <p style="margin:0; font-size:14px; color:#2b2b2b;">${cashierName}</p>
                </td>
                <td style="padding:0 0 4px; width:50%; vertical-align:top;">
                  <p style="margin:0 0 4px; font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#8a8577;">Método de pago</p>
                  <p style="margin:0; font-size:14px; color:#2b2b2b;">${metodoPago}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 28px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <th style="padding:10px;text-align:left;border-top:1px solid #ece7d8;border-bottom:1px solid #ece7d8;background:#faf8f3;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#8a8577;">Producto</th>
                <th style="padding:10px;text-align:right;border-top:1px solid #ece7d8;border-bottom:1px solid #ece7d8;background:#faf8f3;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#8a8577;">Precio unitario</th>
                <th style="padding:10px;text-align:right;border-top:1px solid #ece7d8;border-bottom:1px solid #ece7d8;background:#faf8f3;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#8a8577;">Cant.</th>
                <th style="padding:10px;text-align:right;border-top:1px solid #ece7d8;border-bottom:1px solid #ece7d8;background:#faf8f3;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#8a8577;">Importe</th>
              </tr>
              ${filasItems}
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:8px 28px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align:right;padding:5px 10px 0 0;font-size:13px;color:#555;">Subtotal</td>
                <td style="text-align:right;padding:5px 10px 0 0;font-size:13px;color:#555;width:120px;">${money(subtotal)}</td>
              </tr>
              ${filaDescuento}
              <tr>
                <td style="text-align:right;padding:5px 10px 0 0;font-size:13px;color:#555;">IVA (13%, incluido)</td>
                <td style="text-align:right;padding:5px 10px 0 0;font-size:13px;color:#555;width:120px;">${money(tax)}</td>
              </tr>
              <tr>
                <td style="text-align:right;padding:12px 10px 0 0;font-size:16px;font-weight:700;color:${TEXT_DARK};border-top:1px solid #ece7d8;">Total</td>
                <td style="text-align:right;padding:12px 10px 0 0;font-size:16px;font-weight:700;color:${TEXT_DARK};width:120px;border-top:1px solid #ece7d8;">${money(total)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 28px 28px;">
            <p style="margin:0; font-size:12px; color:#aaa; text-align:center;">
              Esta es una factura electrónica generada automáticamente por SnackFlow POS. Si no reconocés esta compra, contactá al local.
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

    // El PDF trae el mismo desglose que el cuerpo del correo, pero en un
    // documento aparte que el cliente puede guardar/imprimir.
    const pdfBuffer = await buildInvoicePdfBuffer({
      saleId, customerName, customerEmail: to, createdAt, paymentMethod, cashierName,
      items, subtotal, discount, discountPercentage, promotion, tax, total
    });

    // XML de demostración con la forma de un Tiquete Electrónico de Hacienda
    // (ver invoiceXml.service.js) — es solo para mostrar el formato en la
    // demo del proyecto, no un comprobante fiscal real: no tiene firma
    // digital y sus identificadores (Clave, cédula, CABYS) son placeholders.
    const xml = buildInvoiceXml({
      saleId, customerName, customerEmail: to, createdAt, paymentMethod,
      items, subtotal, discount, tax, total
    });

    // Número correlativo con ceros a la izquierda para que el nombre del
    // archivo se vea como el de una factura real, no "factura-7.pdf".
    const numeroFormateado = String(saleId).padStart(6, '0');

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject: `Factura electrónica #${saleId} — La Matamonchis`,
      html,
      attachments: [
        { filename: 'logo.png', path: LOGO_PATH, cid: 'matamonchis-logo' },
        { filename: `LaMatamonchis-Comprobante-${numeroFormateado}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
        { filename: `LaMatamonchis-TiqueteDemo-${numeroFormateado}.xml`, content: xml, contentType: 'text/xml' }
      ]
    });
  }

}

module.exports = new EmailService();
