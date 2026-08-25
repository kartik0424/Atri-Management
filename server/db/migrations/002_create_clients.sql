-- 002: Create clients table
CREATE TABLE clients (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    contact_person  VARCHAR(255),
    mobile          VARCHAR(20),
    email           VARCHAR(255),
    address         TEXT,
    gst_number      VARCHAR(20),
    client_type     VARCHAR(20) NOT NULL DEFAULT 'individual'
                    CHECK (client_type IN ('individual', 'company', 'school', 'college', 'government', 'other')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index: prevent duplicate emails where email is not null
CREATE UNIQUE INDEX idx_clients_email_unique ON clients (email) WHERE email IS NOT NULL;
