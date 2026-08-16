require('dotenv').config();
const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const swaggerUi      = require('swagger-ui-express');
const swaggerSpec    = require('./config/swagger');
const { connectDB, getActiveSource, startHealthCheck } = require('./config/database');
const { initModels } = require('./models');
const { syncPendingSales } = require('../services/dbSync.service');

const authRoutes     = require('./routes/auth.routes');
const salesRoutes    = require('./routes/sales.routes');
const saleItemRoutes = require('./routes/saleItem.routes');
const productsRoutes = require('./routes/products.routes');
const reportsRoutes  = require('./routes/reports.routes');
const usersRoutes    = require('./routes/users.routes');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
// Límite ampliado para admitir imágenes de producto en base64 en el body JSON
app.use(express.json({ limit: '5mb' }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'SnackFlow POS API',
  customCss: '.swagger-ui .topbar { background-color: #1F4E79; }'
}));

app.use('/api/auth',     authRoutes);
app.use('/api/sales',    salesRoutes);
app.use('/api/sales',    saleItemRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/reports',  reportsRoutes);
app.use('/api/users',    usersRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', project: 'SnackFlow POS', database: getActiveSource() }));

const start = async () => {
  await connectDB();
  initModels();

  // Revisa la conexión activa cada 20s y cambia de lado si hace falta (Neon
  // se cae → local; local y Neon vuelve → Neon). Sin esto, connectDB() solo
  // corría una vez al arrancar y un corte de internet a mitad de sesión
  // dejaba el backend intentando usar una conexión a Neon ya rota para
  // siempre, en vez de pasar a Postgres local. Cada cambio de lado vuelve a
  // correr initModels() (los modelos quedan atados a la conexión con la que
  // se definieron) y, si el cambio fue DE VUELTA a Neon, sube las ventas que
  // hayan quedado pendientes en local — ver dbSync.service.js para el
  // alcance real de esa sincronización (solo ventas, no usuarios/productos).
  startHealthCheck(async () => {
    initModels();
    await syncPendingSales();
  });

  app.listen(PORT, () => {
    console.log(`SnackFlow backend corriendo en http://localhost:${PORT}`);
    console.log(`Documentación API: http://localhost:${PORT}/api-docs`);
  });
};

start();
module.exports = app;