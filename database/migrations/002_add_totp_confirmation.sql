-- Migración: confirmación de 2FA con ventana de 24 horas (HU-08)
-- Los usuarios que ya tenían Google Authenticator configurado (totp_secret)
-- se marcan como confirmados retroactivamente.

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_setup_deadline TIMESTAMP;

UPDATE users SET totp_confirmed = TRUE WHERE totp_secret IS NOT NULL;
