const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SnackFlow POS API',
      version: '1.0.0',
      description: `
        API REST del sistema de punto de venta para La Matamonchis S.A.
        
        ## Autenticación
        La mayoría de endpoints requieren un token JWT.
        Obtené el token con POST /api/auth/login y usalo en el header:
        \`Authorization: Bearer {token}\`
        
        ## 2FA
        Los usuarios con Google Authenticator configurado deben proveer
        el código TOTP en el login.
      `,
      contact: {
        name: 'SnackFlow Team',
        email: 'snackflowproject@gmail.com'
      }
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Servidor de desarrollo' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id:        { type: 'integer', example: 1 },
            username:  { type: 'string',  example: 'admin' },
            email:     { type: 'string',  example: 'admin@lamatamonchis.com' },
            full_name: { type: 'string',  example: 'Administrador' },
            role:      { type: 'string',  enum: ['admin', 'cashier'], example: 'admin' },
            active:    { type: 'boolean', example: true },
            totp_confirmed:      { type: 'boolean', example: true },
            totp_setup_deadline: { type: 'string', format: 'date-time', nullable: true },
            must_change_password: { type: 'boolean', example: true }
          }
        },
        Product: {
          type: 'object',
          properties: {
            id:       { type: 'integer', example: 1 },
            name:     { type: 'string',  example: 'Papas' },
            price:    { type: 'number',  example: 800.00 },
            active:   { type: 'boolean', example: true },
            hasImage: { type: 'boolean', example: true, description: 'Indica si tiene imagen; para verla usar GET /api/products/{id}/image' }
          }
        },
        Sale: {
          type: 'object',
          properties: {
            id:             { type: 'integer', example: 1 },
            user_id:        { type: 'integer', example: 3 },
            customer_name:  { type: 'string',  example: 'Juan Pérez' },
            customer_phone: { type: 'string',  example: '8888-8888' },
            notes:          { type: 'string',  example: 'Sin cebolla' },
            subtotal:       { type: 'number',  example: 2400.00 },
            discount:       { type: 'number',  example: 0 },
            tax:            { type: 'number',  example: 312.00 },
            total:          { type: 'number',  example: 2712.00 },
            payment_method: { type: 'string',  enum: ['cash', 'card'], nullable: true },
            status:         { type: 'string',  enum: ['open', 'completed', 'cancelled'] },
            promotion:      { type: 'string',  example: '2x1', nullable: true },
            created_at:     { type: 'string',  format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Mensaje de error' }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.js']
};

module.exports = swaggerJsdoc(options);