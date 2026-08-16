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

function addSummarySheet(workbook, { from, to, count, total, avg, byPaymentMethod, topProduct, topUser }) {
  const sheet = workbook.addWorksheet('Resumen');
  sheet.columns = [{ width: 28 }, { width: 22 }];

  styleTitleRow(sheet, 1, 'Reporte de ventas — La Matamonchis', 2);
  sheet.getCell('A2').value = 'Período';
  sheet.getCell('A2').font = { color: { argb: 'FF8A8577' } };
  sheet.getCell('B2').value = `${from} a ${to}`;
  sheet.getCell('B2').font = { bold: true, color: { argb: TEXT_DARK } };

  // KPIs principales — lo primero que ve alguien con poco tiempo al abrir el archivo.
  const kpis = [
    ['Transacciones', count, false],
    ['Total recaudado', total, true],
    ['Ticket promedio', avg, true],
    ['Efectivo', byPaymentMethod.cash, true],
    ['Tarjeta', byPaymentMethod.card, true]
  ];

  kpis.forEach(([label, value, money], i) => {
    const row = 4 + i;
    sheet.getCell(row, 1).value = label;
    sheet.getCell(row, 1).font = { bold: true, color: { argb: TEXT_DARK } };
    sheet.getCell(row, 2).value = value;
    sheet.getCell(row, 2).font = { size: 13, color: { argb: TEXT_DARK } };
    if (money) sheet.getCell(row, 2).numFmt = MONEY_FORMAT;
  });

  // Destacados — evita tener que ir a buscarlos a las otras hojas.
  const highlightsRow = 10;
  sheet.getCell(highlightsRow, 1).value = 'Destacados del período';
  sheet.getCell(highlightsRow, 1).font = { bold: true, size: 12, color: { argb: TEXT_DARK } };
  sheet.mergeCells(highlightsRow, 1, highlightsRow, 2);

  sheet.getCell(highlightsRow + 1, 1).value = 'Producto más vendido';
  sheet.getCell(highlightsRow + 1, 1).font = { bold: true, color: { argb: TEXT_DARK } };
  sheet.getCell(highlightsRow + 1, 2).value = topProduct ? `${topProduct.product_name} (${topProduct.quantity} und.)` : 'Sin datos';

  sheet.getCell(highlightsRow + 2, 1).value = 'Cajero con más ingresos';
  sheet.getCell(highlightsRow + 2, 1).font = { bold: true, color: { argb: TEXT_DARK } };
  sheet.getCell(highlightsRow + 2, 2).value = topUser ? `${topUser.full_name} (${topUser.count} ventas)` : 'Sin datos';
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
  workbook.views = [{ activeTab: 0 }]; // abre siempre en "Resumen", no en la última hoja usada

  const count = transactions.length;
  const total = transactions.reduce((s, t) => s + t.total, 0);
  const avg = count ? total / count : 0;
  const byPaymentMethod = {
    cash: transactions.filter(t => t.payment_method === 'cash').reduce((s, t) => s + t.total, 0),
    card: transactions.filter(t => t.payment_method === 'card').reduce((s, t) => s + t.total, 0)
  };

  // "Más vendido" es por cantidad, no por ingresos (byProduct viene ordenado por ingresos).
  const topProduct = byProduct.length
    ? byProduct.reduce((max, p) => p.quantity > max.quantity ? p : max, byProduct[0])
    : null;
  const topUser = byUser.length ? byUser[0] : null; // byUser ya viene ordenado por ingresos

  addSummarySheet(workbook, { from, to, count, total, avg, byPaymentMethod, topProduct, topUser });

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
      // Sin timeZone esto se formatea en la hora del contenedor (UTC), no la
      // de Costa Rica (UTC-6) — quedaría 6 horas adelantado en el Excel.
      new Date(t.created_at).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' }),
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
