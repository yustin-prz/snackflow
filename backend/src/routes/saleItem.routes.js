const express = require('express');

const router = express.Router();

const saleItemController = require('../controllers/saleItem.controller');

// Obtener el detalle de una venta
router.get('/:saleId/items', saleItemController.listItems);

// Agregar producto a la venta
router.post('/:saleId/items', saleItemController.addItem);

// Modificar cantidad de un producto
router.put('/items/:itemId', saleItemController.updateItem);

// Eliminar producto del detalle
router.delete('/items/:itemId', saleItemController.removeItem);

module.exports = router;