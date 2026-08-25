-- 008: Create orders table
CREATE TABLE orders (
    id                      SERIAL PRIMARY KEY,
    order_number            VARCHAR(20) NOT NULL UNIQUE,
    client_id               INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    order_date              DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date  DATE,
    subtotal                NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount                NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax                     NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_status          VARCHAR(20) NOT NULL DEFAULT 'unpaid'
                            CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid', 'overpaid')),
    production_status       VARCHAR(20) NOT NULL DEFAULT 'received'
                            CHECK (production_status IN ('received', 'design', 'production', 'quality_check', 'ready', 'delivered', 'cancelled')),
    notes                   TEXT,
    internal_notes          TEXT,
    created_by              INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
