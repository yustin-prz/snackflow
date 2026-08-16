-- Migración: porcentaje del descuento manual (HU-05).
-- Se guarda por separado del monto en colones ("discount") para poder
-- recalcularlo si se agregan/quitan productos después de aplicar el descuento.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2);
