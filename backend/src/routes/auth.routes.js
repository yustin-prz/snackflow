const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  res.json({ message: 'Login endpoint - próximamente' });
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logout endpoint - próximamente' });
});

module.exports = router;
