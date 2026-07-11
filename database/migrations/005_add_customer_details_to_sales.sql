-- Migración: teléfono y notas del cliente en la venta (el wizard "Nueva venta" ya los pedía
-- pero no había dónde guardarlos)

ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes TEXT;
