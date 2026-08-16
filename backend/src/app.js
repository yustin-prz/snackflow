// La app de Express separada del arranque (connectDB + listen), para poder
// importarla en los tests con Supertest sin conectarse a una base de datos
// real ni pelear por el puerto 3000 (que el contenedor ya tiene ocupado).
// index.js es el que de verdad la arranca.
require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const swaggerUi   = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { getActiveSource } = require('./config/database');

const authRoutes     = require('./routes/auth.routes');
const salesRoutes    = require('./routes/sales.routes');
const saleItemRoutes = require('./routes/saleItem.routes');
const productsRoutes = require('./routes/products.routes');
const reportsRoutes  = require('./routes/reports.routes');
const usersRoutes    = require('./routes/users.routes');

const app = express();

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

module.exports = app;
