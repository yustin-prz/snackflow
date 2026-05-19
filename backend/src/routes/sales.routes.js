const express = require('express');
const router = express.Router();

router.get('/',     (req, res) => res.json({ message: 'Listar ventas - próximamente' }));
router.post('/',    (req, res) => res.json({ message: 'Nueva venta - próximamente' }));
router.put('/:id',  (req, res) => res.json({ message: 'Actualizar venta - próximamente' }));
router.post('/:id/items', (req, res) => res.json({ message: 'Agregar artículo - próximamente' }));
router.post('/:id/finish', (req, res) => res.json({ message: 'Terminar venta - próximamente' }));

module.exports = router;
