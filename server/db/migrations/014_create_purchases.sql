-- 014: Create purchases and purchase_items tables
CREATE TABLE purchases (
    id              SERIAL PRIMARY KEY,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    invoice_number  VARCHAR(100),
    notes           TEXT,
    created_by      INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_items (
    id                  SERIAL PRIMARY KEY,
    purchase_id         INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    inventory_item_id   INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    quantity            NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit_cost           NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
    line_total          NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
