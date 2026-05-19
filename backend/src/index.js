require('dotenv').config();
const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const swaggerUi      = require('swagger-ui-express');
const swaggerSpec    = require('./config/swagger');
const { connectDB }  = require('./config/database');

const authRoutes     = require('./routes/auth.routes');
const salesRoutes    = require('./routes/sales.routes');
const productsRoutes = require('./routes/products.routes');
const reportsRoutes  = require('./routes/reports.routes');

const app  = express();
const PORT = process.env.PORT || 3000;

// Seguridad — Helmet con excepción para Swagger UI
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());

// Documentación Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'SnackFlow POS API',
  customCss: '.swagger-ui .topbar { background-color: #1F4E79; }'
}));

// Rutas
app.use('/api/auth',     authRoutes);
app.use('/api/sales',    salesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/reports',  reportsRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', project: 'SnackFlow POS' }));

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`SnackFlow backend corriendo en http://localhost:${PORT}`);
    console.log(`Documentación API: http://localhost:${PORT}/api-docs`);
  });
};

start();
module.exports = app;
