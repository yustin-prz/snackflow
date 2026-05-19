const express = require('express');
const router = express.Router();

router.get('/',     (req, res) => res.json({ message: 'Listar productos - próximamente' }));
router.post('/',    (req, res) => res.json({ message: 'Crear producto - próximamente' }));
router.put('/:id',  (req, res) => res.json({ message: 'Actualizar producto - próximamente' }));

module.exports = router;
