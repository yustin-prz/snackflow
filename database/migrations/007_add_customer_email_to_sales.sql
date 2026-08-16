-- Migración: correo del cliente para la factura electrónica.
-- El campo ya se pedía en el formulario de "Nueva venta" (toggle de factura
-- electrónica) pero nunca se guardaba ni se usaba para nada.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_email VARCHAR(150);
