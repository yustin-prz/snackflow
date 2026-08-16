-- Migración: seguimiento de sincronización local → Neon.
-- Cuando el backend cae a Postgres local (Neon caído) y se crean ventas ahí,
-- estas columnas marcan cuáles todavía no se subieron a Neon. Se aplica en
-- AMBAS bases: en Neon hace falta que la columna exista para poder insertar
-- las filas sincronizadas (mismo set de columnas que el modelo Sequelize),
-- aunque ahí su valor sea siempre true.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS synced_to_neon BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP;
