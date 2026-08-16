const app = require('./app');
const { connectDB, startHealthCheck } = require('./config/database');
const { initModels } = require('./models');
const { syncPendingSales } = require('../services/dbSync.service');

const PORT = process.env.PORT || 3000;

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
