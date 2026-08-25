-- 011: Create payments table
CREATE TABLE payments (
    id              SERIAL PRIMARY KEY,
    order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method  VARCHAR(20) NOT NULL
                    CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'card', 'other')),
    payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    notes           TEXT,
    created_by      INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
