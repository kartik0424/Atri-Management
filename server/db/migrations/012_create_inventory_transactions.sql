-- 012: Create inventory_transactions table (full audit trail)
-- This is the ONLY way inventory quantity should change.
CREATE TABLE inventory_transactions (
    id                  SERIAL PRIMARY KEY,
    inventory_item_id   INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    transaction_type    VARCHAR(30) NOT NULL
                        CHECK (transaction_type IN (
                            'purchase', 'order_consumption', 'manual_adjustment',
                            'return', 'damaged', 'stock_correction', 'transfer'
                        )),
    quantity_change     NUMERIC(12,2) NOT NULL,
    reference_type      VARCHAR(50),
    reference_id        INTEGER,
    cost_at_time        NUMERIC(12,2),
    created_by          INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE inventory_transactions IS 'Full audit trail for inventory changes. Never update inventory_items.current_quantity without creating a corresponding row here.';
COMMENT ON COLUMN inventory_transactions.quantity_change IS 'Positive for additions (purchase, return), negative for reductions (order_consumption, damaged).';
COMMENT ON COLUMN inventory_transactions.reference_type IS 'E.g., order, purchase, manual — the type of entity that caused this transaction.';
COMMENT ON COLUMN inventory_transactions.reference_id IS 'The ID of the referenced entity (order_id, purchase_id, etc.).';
