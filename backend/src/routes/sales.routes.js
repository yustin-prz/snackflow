const express = require('express');
const router = express.Router();

const saleController = require('../controllers/sale.controller');

// Obtener todas las ventas
router.get('/', saleController.list);

// Obtener una venta por id
router.get('/:id', saleController.getById);

// Crear una nueva venta
router.post('/', saleController.create);

module.exports = router;