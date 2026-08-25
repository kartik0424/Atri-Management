-- 010: Create order_status_history table
CREATE TABLE order_status_history (
    id              SERIAL PRIMARY KEY,
    order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL
                    CHECK (status IN ('received', 'design', 'production', 'quality_check', 'ready', 'delivered', 'cancelled')),
    changed_by      INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes           TEXT
);
