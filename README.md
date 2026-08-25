# Atri Management — Printing Business Management & Inventory

A full-stack PERN (PostgreSQL, Express, React, Node.js) monorepo for managing a printing business — orders, clients, inventory, purchases, expenses, and payments.

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 19, TypeScript, Tailwind CSS v3, Vite |
| Backend  | Node.js, Express, TypeScript        |
| Database | PostgreSQL 15+                      |
| Runtime  | Node.js 22+                         |

## Prerequisites

- **Node.js** ≥ 22 and **npm** ≥ 10
- **PostgreSQL** ≥ 15 (running locally or via Docker)

## Getting Started

### 1. Clone & Install

```bash
git clone <repo-url>
cd Atri-Management
npm install        # installs all workspaces (root + server + client)
```

### 2. Configure Environment

Copy the example env file and update it with your PostgreSQL credentials:

```bash
cp .env.example .env
```

Edit `.env` to match your local PostgreSQL setup:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/atri_management
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=atri_management
PORT=3001
NODE_ENV=development
JWT_SECRET=change-this-to-a-random-secret
VITE_API_URL=http://localhost:3001/api
```

### 3. Create the Database

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE atri_management;"
```

### 4. Run Migrations

```bash
npm run db:migrate
```

This runs all 16 SQL migration files in order, creating the full relational schema.

### 5. Seed Demo Data

```bash
npm run db:seed
```

Seeds the database with realistic demo data:
- 3 users (admin, manager, employee) — all passwords: `password123`
- 5 clients (school, company, individual, college, government)
- 3 suppliers
- 10 inventory items (some deliberately below minimum stock)
- 8 products with material recipes (BOM)
- 15 orders including ABC School repeat-order scenario
- Payments, purchases, expenses, and full inventory transaction audit trail

### 6. Start Development

```bash
# Run both server and client concurrently
npm run dev

# Or run them separately
npm run dev:server    # Express API on http://localhost:3001
npm run dev:client    # Vite dev server on http://localhost:5173
```

### 7. Verify

- **Health check:** http://localhost:3001/api/health
- **Client app:** http://localhost:5173

## Project Structure

```
Atri-Management/
├── .env.example           # Environment template
├── package.json           # Root workspace config
├── README.md
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts       # Express app entry point
│   │   ├── db/
│   │   │   └── pool.ts    # PostgreSQL connection pool
│   │   └── routes/
│   │       └── health.ts  # GET /api/health
│   └── db/
│       ├── migrate.ts     # Migration runner
│       ├── seed.ts        # Demo data seeder
│       ├── reset.ts       # Drop all + re-migrate + re-seed
│       └── migrations/
│           ├── 001_create_users.sql
│           ├── 002_create_clients.sql
│           ├── ...
│           └── 016_create_indexes.sql
└── client/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        └── index.css
```

## Available Scripts

| Command              | Description                                    |
|----------------------|------------------------------------------------|
| `npm run dev`        | Start both server and client concurrently      |
| `npm run dev:server` | Start Express API with hot reload              |
| `npm run dev:client` | Start Vite dev server                          |
| `npm run db:migrate` | Run all pending SQL migrations                 |
| `npm run db:seed`    | Seed database with demo data                   |
| `npm run db:reset`   | Drop all tables, re-migrate, and re-seed       |

## Database Schema

The schema includes 15 tables with full relational integrity:

- **users** — Admin/Manager/Employee roles
- **clients** + **client_contacts** — Multi-contact client management
- **suppliers** — Raw material and equipment vendors
- **products** + **product_materials** — Products with BOM (bill of materials) recipes
- **inventory_items** + **inventory_transactions** — Full audit-trail inventory tracking
- **orders** + **order_items** + **order_status_history** — Order lifecycle management
- **payments** — Multi-payment tracking per order
- **purchases** + **purchase_items** — Supplier purchase tracking
- **expenses** — Business expense categorization

### Key Design Decisions

1. **Frozen prices** — `order_items.unit_price` is captured at order time, never recalculated
2. **Inventory audit trail** — All quantity changes go through `inventory_transactions`
3. **RESTRICT on financial FKs** — Cannot delete clients with orders, products with order history, etc.
4. **CHECK constraints** — Enum-like columns enforced at the database level
5. **Auto-updated timestamps** — `updated_at` triggers on all mutable tables

## Demo Users

| Name          | Email                       | Role     | Password      |
|---------------|-----------------------------|----------|---------------|
| Kartik Sharma | kartik@atrimanagement.com   | admin    | password123   |
| Priya Mehta   | priya@atrimanagement.com    | manager  | password123   |
| Ravi Kumar    | ravi@atrimanagement.com     | employee | password123   |
