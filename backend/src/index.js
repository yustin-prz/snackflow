require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { connectDB } = require('./config/database');

const authRoutes     = require('./routes/auth.routes');
const salesRoutes    = require('./routes/sales.routes');
const productsRoutes = require('./routes/products.routes');
const reportsRoutes  = require('./routes/reports.routes');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/auth',     authRoutes);
app.use('/api/sales',    salesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/reports',  reportsRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', project: 'SnackFlow POS' }));

// Arrancar servidor
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`SnackFlow backend corriendo en http://localhost:${PORT}`);
  });
};

start();
module.exports = app;
