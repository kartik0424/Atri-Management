-- 006: Create inventory_items table
CREATE TABLE inventory_items (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    category            VARCHAR(100),
    unit                VARCHAR(50) NOT NULL DEFAULT 'piece',
    current_quantity    NUMERIC(12,2) NOT NULL DEFAULT 0,
    minimum_stock_level NUMERIC(12,2) NOT NULL DEFAULT 0
                        CHECK (minimum_stock_level >= 0),
    purchase_price      NUMERIC(12,2) NOT NULL DEFAULT 0
                        CHECK (purchase_price >= 0),
    average_cost        NUMERIC(12,2) NOT NULL DEFAULT 0
                        CHECK (average_cost >= 0),
    supplier_id         INTEGER REFERENCES suppliers(id) ON DELETE RESTRICT,
    storage_location    VARCHAR(255),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
