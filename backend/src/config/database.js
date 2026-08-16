const { Sequelize } = require('sequelize');

let sequelize;
let activeSource = null; // 'neon' | 'local' — para que /health y los logs digan dónde estamos parados

const createConnection = (url, ssl) => new Sequelize(url, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: ssl ? { require: true, rejectUnauthorized: false } : false,
    connectTimeout: 5000
  },
  logging: false
});

// Abre una conexión NUEVA y la valida antes de devolverla — no toca la
// conexión activa. Así se puede "probar" Neon o local sin arriesgar la que
// ya está funcionando si la prueba falla.
async function probeConnection(url, ssl) {
  const conn = createConnection(url, ssl);
  await conn.authenticate();
  return conn;
}

const connectDB = async () => {
  // Intentar Neon primero si está configurado
  if (process.env.DATABASE_BACKUP_URL) {
    try {
      sequelize = await probeConnection(process.env.DATABASE_BACKUP_URL, true);
      activeSource = 'neon';
      console.log('✅ Conectado a Neon PostgreSQL (nube).');
      return;
    } catch (error) {
      console.warn('⚠️  Neon no disponible, usando BD local...');
    }
  }

  // Fallback a BD local
  try {
    sequelize = await probeConnection(process.env.DATABASE_URL, false);
    activeSource = 'local';
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

const getActiveSource = () => activeSource;

// Reconoce errores de RED/DNS al hablar con la BD (Neon inalcanzable) para
// distinguirlos de errores de negocio (credenciales, validaciones, etc.) —
// estos últimos SÍ deben mostrarse tal cual al usuario, los de red no.
function isConnectionError(error) {
  const code = error && error.original && error.original.code;
  if (code && ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(code)) return true;
  const name = error && error.name;
  return name === 'SequelizeConnectionError'
    || name === 'SequelizeConnectionRefusedError'
    || name === 'SequelizeHostNotFoundError'
    || name === 'SequelizeHostNotReachableError'
    || name === 'SequelizeConnectionTimedOutError';
}

let onSwitchCallback = null;
let switching = false; // evita disparar dos failover a la vez si llegan varios requests fallidos juntos

// Fuerza un intento de cambio de lado YA, sin esperar al próximo tick de
// startHealthCheck() (hasta 20s de por medio). Se llama cuando un request
// real choca con un error de conexión — así "no hay internet, dejame entrar
// por local" no depende de haber tenido la suerte de que ya corriera el
// intervalo. No hace nada si ya estamos en local y local también falla (ya
// no hay a dónde más cambiar) ni si ya hay un failover en curso.
async function triggerFailoverNow() {
  if (switching || activeSource !== 'neon') return;
  switching = true;
  try {
    const localConn = await probeConnection(process.env.DATABASE_URL, false);
    const oldConn = sequelize;
    sequelize = localConn;
    activeSource = 'local';
    await oldConn.close().catch(() => {});
    console.log('✅ Reconectado a PostgreSQL local (disparado por un request fallido).');
    if (onSwitchCallback) await onSwitchCallback();
  } catch (localError) {
    console.error('❌ No se pudo cambiar a PostgreSQL local:', localError.message);
  } finally {
    switching = false;
  }
}

// connectDB() solo corría UNA VEZ, al arrancar el contenedor: si Neon se
// caía DESPUÉS de eso (ej. se desconecta el internet a mitad de una sesión),
// el backend se quedaba intentando usar esa misma conexión rota para
// siempre — nunca pasaba a local, así que "sin internet debería dejar
// entrar por Postgres local" no pasaba de verdad en ese escenario, solo
// funcionaba si el contenedor arrancaba ya sin internet.
//
// Esto revisa la conexión activa cada `intervalMs` y cambia de lado si hace
// falta: Neon → local si se cae, local → Neon apenas vuelve a estar
// disponible. `onSwitch` se usa para volver a correr initModels() contra la
// conexión nueva (los modelos quedan atados a la instancia de Sequelize con
// la que se definieron).
//
// Importante — esto es SOLO failover de conexión, no sincronización de
// datos: si se escribe algo en local mientras Neon está caído, esos
// registros se quedan únicamente ahí. Neon y local son dos bases
// independientes; no hay replicación automática entre ellas. Subirlos a
// mano es lo que hace database/sync-to-neon.sh (y ese script tampoco
// resuelve conflictos de ID si Neon recibió otros datos mientras tanto —
// para eso hace falta diseñarlo aparte, no es un fix de una línea).
function startHealthCheck(onSwitch, intervalMs = 20000) {
  onSwitchCallback = onSwitch; // así triggerFailoverNow() también puede usarlo, no solo el setInterval de abajo
  if (!process.env.DATABASE_BACKUP_URL) return; // sin Neon configurado no hay nada que vigilar

  setInterval(async () => {
    if (switching) return; // ya hay un cambio de lado en curso (ej. disparado por triggerFailoverNow) — no pisarlo

    try {
      if (activeSource === 'neon') {
        await sequelize.authenticate(); // sigue viva, no hay nada que hacer
        return;
      }

      // Estamos en local: probar si Neon ya volvió, sin soltar la conexión
      // local activa a menos que la prueba tenga éxito.
      switching = true;
      const neonConn = await probeConnection(process.env.DATABASE_BACKUP_URL, true);
      const oldConn = sequelize;
      sequelize = neonConn;
      activeSource = 'neon';
      await oldConn.close().catch(() => {});
      console.log('✅ Internet recuperado — reconectado a Neon PostgreSQL.');
      if (onSwitch) await onSwitch();
    } catch (error) {
      if (activeSource !== 'neon') return; // ya estamos en local y también falló: no hay más a qué recurrir

      console.warn('⚠️  Se perdió la conexión a Neon, cambiando a PostgreSQL local...');
      switching = true;
      try {
        const localConn = await probeConnection(process.env.DATABASE_URL, false);
        const oldConn = sequelize;
        sequelize = localConn;
        activeSource = 'local';
        await oldConn.close().catch(() => {});
        console.log('✅ Reconectado a PostgreSQL local.');
        if (onSwitch) await onSwitch();
      } catch (localError) {
        console.error('❌ Neon se cayó y tampoco se pudo conectar a PostgreSQL local:', localError.message);
      }
    } finally {
      switching = false;
    }
  }, intervalMs);
}

module.exports = { connectDB, getSequelize, getActiveSource, startHealthCheck, triggerFailoverNow, isConnectionError };
