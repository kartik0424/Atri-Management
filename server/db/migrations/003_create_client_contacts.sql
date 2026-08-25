-- 003: Create client_contacts table (optional multiple contacts per client)
CREATE TABLE client_contacts (
    id              SERIAL PRIMARY KEY,
    client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    designation     VARCHAR(100),
    mobile          VARCHAR(20),
    email           VARCHAR(255),
    is_primary      BOOLEAN NOT NULL DEFAULT false,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
