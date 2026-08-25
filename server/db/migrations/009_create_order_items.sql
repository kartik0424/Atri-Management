-- 009: Create order_items table
-- unit_price is frozen at order creation, never recalculated from products.default_selling_price
CREATE TABLE order_items (
    id              SERIAL PRIMARY KEY,
    order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity         NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    discount        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    tax             NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
    line_total      NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
