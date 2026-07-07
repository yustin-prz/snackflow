-- Migración: imagen de producto (guardada como base64 en un campo TEXT)

ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT;
