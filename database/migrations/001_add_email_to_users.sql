-- Migración: agregar correo electrónico a los usuarios
-- Requerido para el registro con 2FA obligatorio (HU-08)

ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150);
UPDATE users SET email = username || '@lamatamonchis.local' WHERE email IS NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
