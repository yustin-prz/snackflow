const ExcelJS = require('exceljs');

const BRAND_GOLD = 'FFF9C307';
const TEXT_DARK = 'FF3A2C05';
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GOLD } };
const HEADER_FONT = { bold: true, color: { argb: TEXT_DARK }, size: 12 };
const MONEY_FORMAT = '"₡"#,##0.00';

function styleTitleRow(sheet, rowIndex, text, span) {
  sheet.mergeCells(rowIndex, 1, rowIndex, span);
  const cell = sheet.getCell(rowIndex, 1);
  cell.value = text;
  cell.font = { bold: true, size: 15, color: { argb: TEXT_DARK } };
  cell.fill = HEADER_FILL;
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(rowIndex).height = 26;
}

function addSummarySheet(workbook, { from, to, count, total, avg, byPaymentMethod }) {
  const sheet = workbook.addWorksheet('Resumen');
  sheet.columns = [{ width: 28 }, { width: 22 }];

  styleTitleRow(sheet, 1, 'Reporte de ventas — La Matamonchis', 2);
  sheet.getCell('A2').value = 'Período';
  sheet.getCell('B2').value = `${from} a ${to}`;

  const kpis = [
    ['Transacciones', count],
    ['Total recaudado', total],
    ['Ticket promedio', avg],
    ['Efectivo', byPaymentMethod.cash],
    ['Tarjeta', byPaymentMethod.card]
  ];

  kpis.forEach(([label, value], i) => {
    const row = 4 + i;
    sheet.getCell(row, 1).value = label;
    sheet.getCell(row, 1).font = { bold: true, color: { argb: TEXT_DARK } };
    sheet.getCell(row, 2).value = value;
    if (label !== 'Transacciones') sheet.getCell(row, 2).numFmt = MONEY_FORMAT;
  });

  sheet.getCell(9, 1).value = 'Nota: la hoja "Transacciones" está formateada como Tabla de Excel';
  sheet.getCell(10, 1).value = '(franjas + filtros). Para armar una tabla dinámica: seleccioná esa';
  sheet.getCell(11, 1).value = 'tabla → Insertar → Tabla dinámica.';
  [9, 10, 11].forEach(r => {
    sheet.mergeCells(r, 1, r, 2);
    sheet.getCell(r, 1).font = { italic: true, size: 10, color: { argb: 'FF8A8577' } };
  });
}

function addTableSheet(workbook, { name, columns, rows, tableStyle }) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns.map(c => ({ width: c.width || 18 }));

  sheet.addTable({
    name: name.replace(/\s+/g, '_'),
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: { theme: tableStyle || 'TableStyleMedium9', showRowStripes: true },
    columns: columns.map(c => ({ name: c.header, filterButton: true })),
    rows
  });

  // Formato de moneda en las columnas que lo necesiten
  columns.forEach((c, i) => {
    if (!c.money) return;
    sheet.getColumn(i + 1).numFmt = MONEY_FORMAT;
  });

  sheet.getRow(1).eachCell(cell => {
    cell.font = HEADER_FONT;
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

async function buildReportWorkbook({ from, to, transactions, byProduct, byUser }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SnackFlow POS';
  workbook.created = new Date();

  const count = transactions.length;
  const total = transactions.reduce((s, t) => s + t.total, 0);
  const avg = count ? total / count : 0;
  const byPaymentMethod = {
    cash: transactions.filter(t => t.payment_method === 'cash').reduce((s, t) => s + t.total, 0),
    card: transactions.filter(t => t.payment_method === 'card').reduce((s, t) => s + t.total, 0)
  };

  addSummarySheet(workbook, { from, to, count, total, avg, byPaymentMethod });

  addTableSheet(workbook, {
    name: 'Transacciones',
    columns: [
      { header: '#', width: 8 },
      { header: 'Fecha', width: 20 },
      { header: 'Cliente', width: 22 },
      { header: 'Cajero', width: 22 },
      { header: 'Metodo de pago', width: 16 },
      { header: 'Subtotal', width: 14, money: true },
      { header: 'Descuento', width: 14, money: true },
      { header: 'IVA', width: 14, money: true },
      { header: 'Total', width: 14, money: true }
    ],
    rows: transactions.map(t => [
      t.id,
      new Date(t.created_at).toLocaleString('es-CR'),
      t.customer_name || 'Cliente general',
      t.user.full_name,
      t.payment_method === 'cash' ? 'Efectivo' : t.payment_method === 'card' ? 'Tarjeta' : '',
      t.subtotal, t.discount, t.tax, t.total
    ])
  });

  addTableSheet(workbook, {
    name: 'Productos',
    tableStyle: 'TableStyleMedium7',
    columns: [
      { header: 'Producto', width: 26 },
      { header: 'Cantidad vendida', width: 18 },
      { header: 'Ingresos', width: 16, money: true }
    ],
    rows: byProduct.map(p => [p.product_name, p.quantity, p.subtotal])
  });

  addTableSheet(workbook, {
    name: 'Cajeros',
    tableStyle: 'TableStyleMedium7',
    columns: [
      { header: 'Cajero', width: 26 },
      { header: 'Transacciones', width: 16 },
      { header: 'Ingresos', width: 16, money: true }
    ],
    rows: byUser.map(u => [u.full_name, u.count, u.total])
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = { buildReportWorkbook };
