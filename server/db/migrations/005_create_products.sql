-- 005: Create products table
CREATE TABLE products (
    id                      SERIAL PRIMARY KEY,
    name                    VARCHAR(255) NOT NULL,
    category                VARCHAR(100),
    unit                    VARCHAR(50) NOT NULL DEFAULT 'piece',
    default_selling_price   NUMERIC(12,2) NOT NULL DEFAULT 0
                            CHECK (default_selling_price >= 0),
    active                  BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
