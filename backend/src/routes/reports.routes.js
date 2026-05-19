const express = require('express');
const router = express.Router();

router.get('/by-transaction', (req, res) => res.json({ message: 'Reporte por tipo de transacción - próximamente' }));
router.get('/by-product',     (req, res) => res.json({ message: 'Reporte por producto - próximamente' }));
router.get('/by-user',        (req, res) => res.json({ message: 'Reporte por usuario - próximamente' }));

module.exports = router;
