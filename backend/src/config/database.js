const { Sequelize } = require('sequelize');

let sequelize;

const createConnection = (url, ssl) => new Sequelize(url, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: ssl ? { require: true, rejectUnauthorized: false } : false,
    connectTimeout: 5000
  },
  logging: false
});

const connectDB = async () => {
  // Intentar Neon primero si está configurado
  if (process.env.DATABASE_BACKUP_URL) {
    try {
      sequelize = createConnection(process.env.DATABASE_BACKUP_URL, true);
      await sequelize.authenticate();
      console.log('✅ Conectado a Neon PostgreSQL (nube).');
      return;
    } catch (error) {
      console.warn('⚠️  Neon no disponible, usando BD local...');
    }
  }

  // Fallback a BD local
  try {
    sequelize = createConnection(process.env.DATABASE_URL, false);
    await sequelize.authenticate();
    console.log('✅ Conectado a PostgreSQL local (sin internet).');
  } catch (error) {
    console.error('❌ No se pudo conectar a ninguna base de datos:', error.message);
    process.exit(1);
  }
};

const getSequelize = () => {
  if (!sequelize) throw new Error('Base de datos no inicializada.');
  return sequelize;
};

module.exports = { connectDB, getSequelize };