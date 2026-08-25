-- 013: Create expenses table
CREATE TABLE expenses (
    id              SERIAL PRIMARY KEY,
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    category        VARCHAR(30) NOT NULL
                    CHECK (category IN (
                        'raw_materials', 'equipment', 'maintenance', 'electricity',
                        'transport', 'packaging', 'office', 'other'
                    )),
    description     TEXT NOT NULL,
    amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method  VARCHAR(20)
                    CHECK (payment_method IS NULL OR payment_method IN ('cash', 'upi', 'bank_transfer', 'card', 'other')),
    invoice_number  VARCHAR(100),
    notes           TEXT,
    created_by      INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
