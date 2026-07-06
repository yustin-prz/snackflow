-- Migración: contraseña temporal obligatoria en el primer login (HU-08)

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
