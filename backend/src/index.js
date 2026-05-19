require('dotenv').config();
const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const swaggerUi      = require('swagger-ui-express');
const swaggerSpec    = require('./config/swagger');
const { connectDB }  = require('./config/database');
const { initModels } = require('./models');

const authRoutes     = require('./routes/auth.routes');
const salesRoutes    = require('./routes/sales.routes');
const productsRoutes = require('./routes/products.routes');
const reportsRoutes  = require('./routes/reports.routes');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'SnackFlow POS API',
  customCss: '.swagger-ui .topbar { background-color: #1F4E79; }'
}));

app.use('/api/auth',     authRoutes);
app.use('/api/sales',    salesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/reports',  reportsRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', project: 'SnackFlow POS' }));

const start = async () => {
  await connectDB();
  initModels();
  app.listen(PORT, () => {
    console.log(`SnackFlow backend corriendo en http://localhost:${PORT}`);
    console.log(`Documentación API: http://localhost:${PORT}/api-docs`);
  });
};

start();
module.exports = app;