const path = require('path');
const PDFDocument = require('pdfkit');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'img', 'logo.png');
const FONT_REGULAR_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FONT_BOLD_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');
const BRAND_GOLD = '#f9c307';
const TEXT_DARK = '#3a2c05';
const TEXT_MUTED = '#8a8577';
const BORDER = '#ece7d8';

// La fuente estándar Helvetica (WinAnsiEncoding) no tiene el glifo de ₡
// (U+20A1) — sin una fuente TTF con Unicode embebida, PDFKit lo cambiaba por
// otro carácter (salía "¡" pegado al número). Por eso el PDF usa DejaVu Sans
// (TTF embebido, ver assets/fonts/) en vez de Helvetica — sí tiene el glifo.
function money(n) {
  return '₡' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// PDF adjunto a la factura electrónica por correo (invoiceEmail / email.service.js).
// Es un comprobante/recibo interno de La Matamonchis, NO un comprobante
// electrónico autorizado por el Ministerio de Hacienda de Costa Rica — eso
// requiere ser un proveedor certificado, firmar el XML con un certificado
// digital y transmitirlo a su API, que está fuera del alcance de este
// proyecto. El formato (desglose de líneas, IVA separado, etc.) se inspira
// en la estructura del XSD oficial que usa Hacienda, pero adaptado a un
// documento simple, no fiscalmente vinculante.
function buildInvoicePdfBuffer({ saleId, customerName, customerEmail, createdAt, paymentMethod, cashierName, items, subtotal, discount, discountPercentage, promotion, tax, total }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('DejaVu', FONT_REGULAR_PATH);
    doc.registerFont('DejaVu-Bold', FONT_BOLD_PATH);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;

    // ---- Encabezado ----
    try {
      doc.image(LOGO_PATH, left, 45, { width: 44, height: 44 });
    } catch (e) {
      // Si el logo no está disponible, el PDF se genera igual sin imagen.
    }
    doc.fillColor(TEXT_DARK).font('DejaVu-Bold').fontSize(18).text('SnackFlow POS', left + 56, 48);
    doc.fillColor(TEXT_MUTED).font('DejaVu').fontSize(10).text('La Matamonchis S.A.', left + 56, 70);

    doc.fillColor(TEXT_DARK).font('DejaVu-Bold').fontSize(13).text('Comprobante de compra', left, 105, { width: pageWidth, align: 'right' });
    doc.fillColor(TEXT_MUTED).font('DejaVu').fontSize(10).text(`Nº ${saleId}`, left, 122, { width: pageWidth, align: 'right' });

    doc.moveTo(left, 145).lineTo(left + pageWidth, 145).strokeColor(BRAND_GOLD).lineWidth(2).stroke();

    // ---- Datos de la venta / cliente ----
    const fecha = new Date(createdAt).toLocaleString('es-CR', {
      dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Costa_Rica'
    });
    const metodoPago = paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta';

    let y = 162;
    const col2 = left + pageWidth / 2;

    // Ancho fijo por columna (mitad de la página, con un gutter) — sin esto,
    // un nombre/correo/cajero medianamente largo se corre hacia la derecha
    // y queda escrito encima del texto de la columna vecina.
    const fieldWidth = pageWidth / 2 - 16;
    const field = (label, value, x, yPos) => {
      doc.fillColor(TEXT_MUTED).font('DejaVu').fontSize(8).text(label.toUpperCase(), x, yPos, { width: fieldWidth });
      doc.fillColor(TEXT_DARK).font('DejaVu').fontSize(10).text(value || '—', x, yPos + 11, { width: fieldWidth });
    };

    field('Cliente', customerName || 'Cliente general', left, y);
    field('Correo', customerEmail || '—', col2, y);
    y += 34;
    field('Fecha', fecha, left, y);
    field('Atendido por', cashierName, col2, y);
    y += 34;
    field('Método de pago', metodoPago, left, y);
    y += 34;

    // ---- Tabla de items ----
    const colProducto = left;
    const colPrecio = left + pageWidth * 0.45;
    const colCant = left + pageWidth * 0.68;
    const colImporte = left + pageWidth * 0.80;
    const colImporteWidth = pageWidth * 0.20;

    doc.rect(left, y, pageWidth, 20).fill('#faf8f3');
    doc.fillColor(TEXT_MUTED).font('DejaVu-Bold').fontSize(8);
    doc.text('PRODUCTO', colProducto + 6, y + 6);
    doc.text('PRECIO UNIT.', colPrecio, y + 6, { width: colCant - colPrecio, align: 'right' });
    doc.text('CANT.', colCant, y + 6, { width: colImporte - colCant, align: 'right' });
    doc.text('IMPORTE', colImporte, y + 6, { width: colImporteWidth - 6, align: 'right' });
    y += 24;

    doc.font('DejaVu').fontSize(9.5);
    items.forEach((item, i) => {
      if (y > doc.page.height - 200) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      const rowHeight = 20;
      if (i % 2 === 1) doc.rect(left, y - 3, pageWidth, rowHeight).fill('#faf8f3');
      doc.fillColor(TEXT_DARK);
      doc.text(item.product_name, colProducto + 6, y, { width: colPrecio - colProducto - 10 });
      doc.text(money(item.unit_price), colPrecio, y, { width: colCant - colPrecio, align: 'right' });
      doc.text(String(item.quantity), colCant, y, { width: colImporte - colCant, align: 'right' });
      doc.font('DejaVu-Bold').text(money(item.subtotal), colImporte, y, { width: colImporteWidth - 6, align: 'right' });
      doc.font('DejaVu');
      y += rowHeight;
    });

    doc.moveTo(left, y).lineTo(left + pageWidth, y).strokeColor(BORDER).lineWidth(1).stroke();
    y += 12;

    // ---- Totales ----
    const totalsLabelWidth = pageWidth * 0.75;
    const totalsValueX = left + totalsLabelWidth;
    const totalsValueWidth = pageWidth - totalsLabelWidth;

    // Mismo alto de fila que la tabla de productos (20) para que no se vea
    // más apretado que el resto del documento.
    const totalRow = (label, value, bold) => {
      doc.font(bold ? 'DejaVu-Bold' : 'DejaVu').fontSize(bold ? 12 : 10).fillColor(bold ? TEXT_DARK : TEXT_MUTED);
      doc.text(label, left, y, { width: totalsLabelWidth, align: 'right' });
      doc.fillColor(TEXT_DARK).text(value, totalsValueX, y, { width: totalsValueWidth, align: 'right' });
      y += bold ? 24 : 20;
    };

    totalRow('Subtotal', money(subtotal), false);
    if (Number(discount) > 0) {
      const etiqueta = promotion === '2x1' ? 'Promoción 2x1 Gelatina' : `Descuento (${discountPercentage}%)`;
      totalRow(etiqueta, `-${money(discount)}`, false);
    }
    totalRow('IVA (13%, incluido)', money(tax), false);
    y += 4;
    doc.moveTo(totalsValueX - 10, y).lineTo(left + pageWidth, y).strokeColor(BORDER).stroke();
    y += 10;
    totalRow('Total', money(total), true);

    // ---- Pie ----
    // Va pegado al contenido (con un margen fijo), no clavado al fondo de la
    // hoja A4 — con pocos items eso dejaba media página en blanco.
    const footerY = y + 30;
    doc.moveTo(left, footerY).lineTo(left + pageWidth, footerY).strokeColor(BORDER).stroke();

    const disclaimer = 'Este es un comprobante interno de compra generado por SnackFlow POS, no un comprobante electrónico autorizado por el Ministerio de Hacienda de Costa Rica.';
    doc.fillColor(TEXT_MUTED).font('DejaVu').fontSize(7.5);
    // El texto es largo y hace salto de línea — la siguiente línea tiene que
    // ir después de la altura REAL que ocupó (heightOfString), no en un
    // offset fijo, o se monta encima cuando el texto envuelve a 2 líneas.
    const disclaimerHeight = doc.heightOfString(disclaimer, { width: pageWidth, align: 'center' });
    doc.text(disclaimer, left, footerY + 10, { width: pageWidth, align: 'center' });
    doc.text('SnackFlow POS · La Matamonchis S.A.', left, footerY + 10 + disclaimerHeight + 4, { width: pageWidth, align: 'center' });

    doc.end();
  });
}

module.exports = { buildInvoicePdfBuffer };
