const { Sequelize } = require('sequelize');
const { getSequelize, getActiveSource } = require('../src/config/database');

// Alcance de esta sincronización, a propósito limitado a ventas:
//   - `sales` + `sale_items` — es la única data que de verdad no se puede
//     perder (una venta ya cobrada). Se resuelve reasignando un id nuevo en
//     Neon (no se reutiliza el id local, para no chocar con lo que Neon ya
//     tenga) y remapeando sale_items.sale_id al id nuevo.
//   - `users` y `products` quedan AFUERA a propósito:
//       · `users` mete contraseñas/2FA — fusionar cuentas creadas en dos
//         bases distintas sin supervisión es un riesgo de seguridad, no
//         algo para automatizar sin pensarlo bien.
//       · `products` casi nunca se crea/edita en medio de un corte de
//         internet, y el id de producto se asume igual entre local y Neon
//         (las dos parten del mismo init.sql/migraciones — ver notas del
//         proyecto). Si de casualidad se crea un producto NUEVO estando en
//         local y después se vende, esa venta puntual va a fallar al
//         sincronizar (el product_id no existe en Neon) — queda sin
//         sincronizar y se loguea el error; no se inventa un producto en
//         Neon para no arriesgar duplicados.
//
// user_id / product_id de las ventas sincronizadas SÍ se asumen iguales
// entre local y Neon (mismo argumento: los usuarios y productos existentes
// se asume que están replicados 1:1 entre las dos bases).

function connectLocalReadonly() {
  return new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: false, connectTimeout: 5000 },
    logging: false
  });
}

const SALE_COLUMNS = [
  'user_id', 'customer_name', 'customer_phone', 'customer_email', 'notes',
  'subtotal', 'discount', 'discount_percentage', 'tax', 'total',
  'payment_method', 'status', 'promotion', 'created_at'
];

// Sube a Neon las ventas que se crearon mientras el backend corría sobre
// Postgres local (Neon caído). Se llama sola cuando startHealthCheck()
// detecta que Neon volvió a estar disponible — ver src/index.js.
async function syncPendingSales() {
  if (getActiveSource() !== 'neon') return; // solo tiene sentido subir HACIA Neon estando conectados a Neon

  const local = connectLocalReadonly();
  let pendingSales;

  try {
    await local.authenticate();
    [pendingSales] = await local.query('SELECT * FROM sales WHERE synced_to_neon = false ORDER BY id ASC');
  } catch (error) {
    console.error('⚠️  No se pudo revisar ventas pendientes de sincronizar (Postgres local no disponible):', error.message);
    await local.close().catch(() => {});
    return;
  }

  if (!pendingSales.length) {
    await local.close().catch(() => {});
    return;
  }

  console.log(`🔄 Sincronizando ${pendingSales.length} venta(s) pendiente(s) hacia Neon...`);
  const neon = getSequelize();
  let synced = 0;

  for (const sale of pendingSales) {
    const t = await neon.transaction();
    try {
      const columnList = SALE_COLUMNS.join(', ');
      const placeholders = SALE_COLUMNS.map(c => `:${c}`).join(', ');

      const [[newSale]] = await neon.query(
        `INSERT INTO sales (${columnList}, synced_to_neon, synced_at)
         VALUES (${placeholders}, true, now())
         RETURNING id`,
        { replacements: sale, transaction: t }
      );

      const [items] = await local.query('SELECT * FROM sale_items WHERE sale_id = :saleId', {
        replacements: { saleId: sale.id }
      });

      for (const item of items) {
        await neon.query(
          `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
           VALUES (:sale_id, :product_id, :quantity, :unit_price, :subtotal)`,
          {
            replacements: {
              sale_id: newSale.id,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal
            },
            transaction: t
          }
        );
      }

      await t.commit();

      await local.query('UPDATE sales SET synced_to_neon = true, synced_at = now() WHERE id = :id', {
        replacements: { id: sale.id }
      });

      synced++;
    } catch (error) {
      await t.rollback();
      console.error(`❌ No se pudo sincronizar la venta local #${sale.id} (se reintenta en la próxima reconexión):`, error.message);
      break; // no seguir con las siguientes para no dejar el orden a medias
    }
  }

  await local.close().catch(() => {});
  console.log(`✅ Sincronización con Neon completa: ${synced}/${pendingSales.length} venta(s) subida(s).`);
}

module.exports = { syncPendingSales };
