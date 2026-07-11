const reportService = require('../../services/report.service');
const { buildReportWorkbook } = require('../../services/reportExcel.service');

const byTransaction = async (req, res) => {
  try {
    const data = await reportService.byTransaction(req.query.from, req.query.to);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const byProduct = async (req, res) => {
  try {
    const data = await reportService.byProduct(req.query.from, req.query.to);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const byUser = async (req, res) => {
  try {
    const data = await reportService.byUser(req.query.from, req.query.to);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const exportExcel = async (req, res) => {
  try {
    const { from, to } = req.query;
    const [transactions, byProductData, byUserData] = await Promise.all([
      reportService.byTransaction(from, to),
      reportService.byProduct(from, to),
      reportService.byUser(from, to)
    ]);

    const buffer = await buildReportWorkbook({ from, to, transactions, byProduct: byProductData, byUser: byUserData });

    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="reporte-snackflow_${from}_a_${to}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { byTransaction, byProduct, byUser, exportExcel };
