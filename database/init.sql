-- SnackFlow POS — Script de inicialización
-- Ejecutar en Neon PostgreSQL

CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(50) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    full_name   VARCHAR(100) NOT NULL,
    role        VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'cashier')),
    active      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    price       NUMERIC(10,2) NOT NULL,
    active      BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sales (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    customer_name   VARCHAR(100),
    subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount        NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax             NUMERIC(10,2) NOT NULL DEFAULT 0,
    total           NUMERIC(10,2) NOT NULL DEFAULT 0,
    payment_method  VARCHAR(20) CHECK (payment_method IN ('cash', 'card')),
    status          VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
    promotion       VARCHAR(50),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
    id          SERIAL PRIMARY KEY,
    sale_id     INTEGER REFERENCES sales(id),
    product_id  INTEGER REFERENCES products(id),
    quantity    INTEGER NOT NULL,
    unit_price  NUMERIC(10,2) NOT NULL,
    subtotal    NUMERIC(10,2) NOT NULL
);

-- Productos iniciales de La Matamonchis
INSERT INTO products (name, price) VALUES
    ('Papas',      800.00),
    ('Bolis',      500.00),
    ('Empanadas', 1200.00),
    ('Gelatinas',  500.00),
    ('Coca Cola', 1000.00),
    ('Agua',       600.00)
ON CONFLICT DO NOTHING;

-- Usuario administrador por defecto (contraseña: Admin1234)
INSERT INTO users (username, password, full_name, role) VALUES
    ('admin', '$2a$10$placeholder_hash_cambiar_en_produccion', 'Administrador', 'admin')
ON CONFLICT DO NOTHING;
