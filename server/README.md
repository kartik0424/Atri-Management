# Atri Management — Backend API Reference & Examples

This document outlines the REST API modules, authentication, authorization rules, and runnable `curl` examples.

---

## Base URL
```
http://localhost:3001/api
```

## Standard Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable confirmation message",
  "warning": "Optional warning message",
  "duplicates": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Descriptive error message",
    "code": "BAD_REQUEST | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | INSUFFICIENT_STOCK_WARNING | VALIDATION_ERROR",
    "details": { ... }
  }
}
```

---

## Authentication & Authorization

All endpoints except `/api/health` and `/api/auth/login` require an `Authorization` header with a Bearer JWT:
```http
Authorization: Bearer <JWT_TOKEN>
```

### Roles:
- `admin`: Full access across all modules.
- `manager`: Full access across all modules.
- `employee`: Access to read, create, and update records. **Blocked from deleting inventory items/transactions and financial records.**

---

## 1. Authentication Module (`/api/auth`)

### 1.1 Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "kartik@atrimanagement.com",
    "password": "password123"
  }'
```

### 1.2 Get Current User
```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer <TOKEN>"
```

### 1.3 Logout
```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 2. Clients Module (`/api/clients`)

### 2.1 List Clients (Paginated + Filtered)
```bash
curl -X GET "http://localhost:3001/api/clients?page=1&limit=20&search=school" \
  -H "Authorization: Bearer <TOKEN>"
```

### 2.2 Quick Search
```bash
curl -X GET "http://localhost:3001/api/clients/search?q=ABC" \
  -H "Authorization: Bearer <TOKEN>"
```

### 2.3 Create Client (With Duplicate Detection)
```bash
curl -X POST http://localhost:3001/api/clients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "name": "Global Tech Academy",
    "contact_person": "Dr. Vikas Jain",
    "mobile": "9811223344",
    "email": "info@globaltech.edu.in",
    "client_type": "school",
    "contacts": [
      {
        "name": "Vikas Jain",
        "designation": "Director",
        "mobile": "9811223344",
        "email": "director@globaltech.edu.in",
        "is_primary": true
      }
    ]
  }'
```

*Note: If an existing client matches the mobile/email, a duplicate warning with matching records is returned. Pass `"allow_duplicate": true` to force creation.*

### 2.4 Get Client Profile (Aggregations + History)
```bash
curl -X GET http://localhost:3001/api/clients/1/profile \
  -H "Authorization: Bearer <TOKEN>"
```
**Response includes:**
- Total orders count
- Total quantity ordered
- Total amount billed
- Total amount paid
- Outstanding balance
- Last order date
- Top 5 frequently ordered products
- Full chronological order history
- Full payment transaction history

---

## 3. Products & Material Recipes / BOM (`/api/products`)

### 3.1 List Products
```bash
curl -X GET "http://localhost:3001/api/products?active=true" \
  -H "Authorization: Bearer <TOKEN>"
```

### 3.2 Create Product with Recipe (BOM)
```bash
curl -X POST http://localhost:3001/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "name": "Tri-Fold Product Brochure",
    "category": "Marketing",
    "unit": "100 pcs",
    "default_selling_price": 1250.00,
    "materials": [
      { "inventory_item_id": 2, "quantity_required_per_unit": 0.5 },
      { "inventory_item_id": 5, "quantity_required_per_unit": 0.1 }
    ]
  }'
```

### 3.3 Calculate Material Requirements for an Order Quantity
```bash
curl -X GET "http://localhost:3001/api/products/1/material-requirements?quantity=50" \
  -H "Authorization: Bearer <TOKEN>"
```
**Returns:**
- Raw material breakdown per BOM recipe
- Total raw material quantity required
- Current stock available vs required
- Stock shortage amounts
- `can_fulfill_from_stock`: boolean
- Estimated raw material cost

---

## 4. Inventory & Adjustments (`/api/inventory`)

### 4.1 List Inventory Items (Filters: low_stock / out_of_stock)
```bash
curl -X GET "http://localhost:3001/api/inventory?filter=low_stock" \
  -H "Authorization: Bearer <TOKEN>"
```

### 4.2 Adjust Stock (Atomic Transaction + Audit Log)
```bash
curl -X POST http://localhost:3001/api/inventory/1/adjust \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "quantity_change": -5,
    "transaction_type": "damaged",
    "notes": "5 reams water damaged during transit"
  }'
```

### 4.3 Negative Stock Rejection & Override Rule
If an adjustment would cause stock to drop below 0:
```bash
# This will be REJECTED with 400 INSUFFICIENT_STOCK_WARNING:
curl -X POST http://localhost:3001/api/inventory/1/adjust \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "quantity_change": -500,
    "transaction_type": "manual_adjustment"
  }'

# Explicit Override (ALLOWED with reason):
curl -X POST http://localhost:3001/api/inventory/1/adjust \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "quantity_change": -500,
    "transaction_type": "manual_adjustment",
    "allow_negative": true,
    "reason": "Emergency order print run before raw material delivery"
  }'
```

### 4.4 View Item Transaction History
```bash
curl -X GET "http://localhost:3001/api/inventory/1/transactions?page=1&limit=20" \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 5. Suppliers Module (`/api/suppliers`)

### 5.1 List Suppliers
```bash
curl -X GET http://localhost:3001/api/suppliers \
  -H "Authorization: Bearer <TOKEN>"
```

### 5.2 Create Supplier
```bash
curl -X POST http://localhost:3001/api/suppliers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "name": "Apex Color Labs",
    "contact_person": "Anand Gupta",
    "mobile": "9829001122",
    "email": "anand@apexcolor.in",
    "address": "Bais Godam Industrial Estate, Jaipur",
    "gst_number": "08AAAPA1234F1Z8"
  }'
```

---

## 6. Orders Module & Production Workflow (`/api/orders`)

### 6.1 Create Order (Multi-line items + server-side pricing calculation)
*Creates order in `received` status without touching inventory.*
```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "client_id": 1,
    "expected_delivery_date": "2026-09-10",
    "items": [
      {
        "product_id": 1,
        "quantity": 10,
        "unit_price": 250.00,
        "discount": 50.00,
        "tax": 441.00
      },
      {
        "product_id": 4,
        "quantity": 100,
        "unit_price": 18.00,
        "discount": 0,
        "tax": 324.00
      }
    ],
    "notes": "School teacher visiting cards + event banners"
  }'
```

### 6.2 Check Material Availability Before Production
```bash
curl -X GET http://localhost:3001/api/orders/1/material-requirements \
  -H "Authorization: Bearer <TOKEN>"
```

### 6.3 Move into Production (Atomic Inventory Consumption)
*Recalculates stock requirements and deducts raw materials from inventory.*
```bash
# Normal transition (requires sufficient stock):
curl -X POST http://localhost:3001/api/orders/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "status": "production",
    "notes": "Started printing run"
  }'

# Force transition with negative stock override (if shortfall detected):
curl -X POST http://localhost:3001/api/orders/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "status": "production",
    "force": true,
    "reason": "VIP order — paper restock shipment arriving tonight"
  }'
```

### 6.4 Subsequent Status Transitions
*Transitions through the production pipeline: `production` $\to$ `quality_check` $\to$ `ready` $\to$ `delivered`.*
```bash
curl -X POST http://localhost:3001/api/orders/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "status": "quality_check",
    "notes": "Color calibration verified"
  }'
```

### 6.5 Repeat Order Duplication
*Creates a brand new draft order (`received` / `unpaid`) with a new order number while keeping the original intact.*
```bash
curl -X POST http://localhost:3001/api/orders/1/duplicate \
  -H "Authorization: Bearer <TOKEN>"
```

### 6.6 Order Cancellation & Inventory Restoration
```bash
# 1. Cancel order
curl -X POST http://localhost:3001/api/orders/1/cancel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{ "notes": "Client requested cancellation" }'

# 2. Restore previously consumed inventory (creates offsetting return audit records)
curl -X POST http://localhost:3001/api/orders/1/restore-inventory \
  -H "Authorization: Bearer <TOKEN>"
```

### 6.7 Order Profitability Analytics
```bash
curl -X GET http://localhost:3001/api/orders/1/profitability \
  -H "Authorization: Bearer <TOKEN>"
```
**Returns:**
- Billed revenue vs subtotal
- Material cost at consumption time (from `inventory_transactions`)
- Gross profit
- Gross margin %
- Per-material cost breakdown

---

## Running Automated Integration Tests

Run the complete test suite verifying all 6 modules, RBAC rules, duplicate client detection, negative stock constraints, and order workflows:

```bash
# From workspace root:
npm test

# Or within /server:
cd server && npm test
```
