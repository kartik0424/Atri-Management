import path from 'node:path';
import dotenv from 'dotenv';

// Load .env before running tests
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import http from 'node:http';
import { app } from '../src/app.js';
import pool from '../src/db/pool.js';

let server: http.Server;
let baseUrl: string;
let adminToken: string;
let employeeToken: string;

// Helper to make JSON HTTP requests
async function request(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    token?: string;
    query?: Record<string, string>;
  } = {}
) {
  const { method = 'GET', body, token, query } = options;

  let url = `${baseUrl}${endpoint}`;
  if (query) {
    const params = new URLSearchParams(query);
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    status: res.status,
    ok: res.ok,
    data,
  };
}

// Simple test runner
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function test(name: string, fn: () => Promise<void>) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passedTests++;
  } catch (error: any) {
    console.error(`  ❌ ${name}`);
    console.error(`     Error: ${error.message}`);
    failedTests++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message} (Expected: ${expected}, Got: ${actual})`);
  }
}

async function runTests() {
  console.log('\n🧪 Starting Atri Management Integration Tests...\n');

  // Start temporary test server
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address() as any;
      baseUrl = `http://localhost:${address.port}`;
      resolve();
    });
  });

  console.log(`🌐 Test server listening at ${baseUrl}\n`);

  try {
    // ─── 1. AUTH TESTS ──────────────────────────────────────────────
    console.log('📦 Testing Module: AUTH & RBAC');

    await test('POST /api/auth/login succeeds for admin user and returns JWT token', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'kartik@atrimanagement.com',
          password: 'password123',
        },
      });

      assertEqual(res.status, 200, 'Login status 200');
      assert(res.data.success === true, 'Response success is true');
      assert(typeof res.data.data.token === 'string', 'Token is returned');
      assertEqual(res.data.data.user.role, 'admin', 'User role is admin');

      adminToken = res.data.data.token;
    });

    await test('POST /api/auth/login succeeds for employee user', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'ravi@atrimanagement.com',
          password: 'password123',
        },
      });

      assertEqual(res.status, 200, 'Login status 200');
      assertEqual(res.data.data.user.role, 'employee', 'User role is employee');

      employeeToken = res.data.data.token;
    });

    await test('POST /api/auth/login rejects invalid password', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'kartik@atrimanagement.com',
          password: 'wrongpassword',
        },
      });

      assertEqual(res.status, 401, 'Rejection status 401');
      assert(res.data.success === false, 'Response success is false');
    });

    await test('GET /api/auth/me returns authenticated user profile', async () => {
      const res = await request('/api/auth/me', { token: adminToken });
      assertEqual(res.status, 200, 'Status 200');
      assertEqual(res.data.data.email, 'kartik@atrimanagement.com', 'Matches email');
    });

    await test('Protected endpoints reject unauthenticated requests (401)', async () => {
      const res = await request('/api/clients');
      assertEqual(res.status, 401, 'Status 401 on missing token');
    });

    // ─── 2. CLIENTS & DUPLICATE CHECKS ──────────────────────────────
    console.log('\n📦 Testing Module: CLIENTS & DUPLICATE RULES');

    let createdClientId: number;

    await test('GET /api/clients lists seeded clients with pagination', async () => {
      const res = await request('/api/clients', { token: adminToken });
      assertEqual(res.status, 200, 'Status 200');
      assert(res.data.data.length >= 5, 'At least 5 clients returned');
      assert(res.data.pagination.total >= 5, 'Pagination total accurate');
    });

    const uniqueSuffix = Date.now().toString().slice(-6);

    await test('POST /api/clients creates new unique client successfully', async () => {
      const res = await request('/api/clients', {
        method: 'POST',
        token: adminToken,
        body: {
          name: `Unique Test Client Corp ${uniqueSuffix}`,
          contact_person: 'Vikram Mehta',
          mobile: `911${uniqueSuffix}`,
          email: `vikram_${uniqueSuffix}@uniquecorp.in`,
          client_type: 'company',
          contacts: [
            {
              name: 'Secondary Contact',
              designation: 'Finance Lead',
              mobile: `912${uniqueSuffix}`,
              email: `finance_${uniqueSuffix}@uniquecorp.in`,
            },
          ],
        },
      });

      assertEqual(res.status, 201, 'Status 201 Created');
      assert(res.data.success === true, 'Success is true');
      assert(res.data.data.contacts.length === 1, 'Child contact inserted');
      createdClientId = res.data.data.id;
    });

    await test('POST /api/clients returns DUPLICATE WARNING when mobile/email matches existing client', async () => {
      const res = await request('/api/clients', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'ABC School Duplicate Attempt',
          contact_person: 'Another Person',
          mobile: '9876543210', // Existing ABC School mobile
          email: 'admin@abcschool.edu.in', // Existing ABC School email
          client_type: 'school',
        },
      });

      assertEqual(res.status, 200, 'Returns 200 with warning instead of silent creation');
      assert(res.data.warning !== undefined, 'Warning field present in response');
      assert(res.data.duplicates.length > 0, 'Matching duplicate records provided');
      assertEqual(res.data.data, null, 'Client is not created without allow_duplicate flag');
    });

    await test('POST /api/clients allows creation when allow_duplicate: true is explicitly passed', async () => {
      const res = await request('/api/clients', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'ABC School Branch 2',
          contact_person: 'Mrs. Sunita Verma',
          mobile: '9876543210',
          client_type: 'school',
          allow_duplicate: true,
        },
      });

      assertEqual(res.status, 201, 'Status 201 Created');
      assert(res.data.data.id !== undefined, 'New client created');
      assert(res.data.warning !== undefined, 'Warning attached acknowledging duplicate');
    });

    await test('GET /api/clients/search?q=ABC returns matching clients', async () => {
      const res = await request('/api/clients/search', {
        token: adminToken,
        query: { q: 'ABC' },
      });

      assertEqual(res.status, 200, 'Status 200');
      assert(res.data.data.length >= 1, 'Found ABC School');
    });

    await test('GET /api/clients/:id/profile returns comprehensive aggregate metrics & history', async () => {
      // Find ABC School ID
      const clientsRes = await request('/api/clients/search', {
        token: adminToken,
        query: { q: 'ABC School' },
      });
      const abcId = clientsRes.data.data[0].id;

      const res = await request(`/api/clients/${abcId}/profile`, { token: adminToken });
      assertEqual(res.status, 200, 'Status 200');
      assert(res.data.data.metrics.total_orders >= 3, 'ABC School has at least 3 orders from seed');
      assert(res.data.data.metrics.total_amount_billed > 0, 'Total billed calculated');
      assert(res.data.data.metrics.total_amount_paid > 0, 'Total paid calculated');
      assert(res.data.data.top_products.length > 0, 'Top products aggregated');
      assert(res.data.data.orders_history.length >= 3, 'Order history returned');
      assert(res.data.data.payments_history.length >= 1, 'Payment history returned');
    });

    // ─── 3. PRODUCTS & MATERIAL RECIPES (BOM) ───────────────────────
    console.log('\n📦 Testing Module: PRODUCTS & MATERIAL RECIPES (BOM)');

    let newProductId: number;

    await test('GET /api/products returns products list with materials count', async () => {
      const res = await request('/api/products', { token: adminToken });
      assertEqual(res.status, 200, 'Status 200');
      assert(res.data.data.length >= 8, 'Seeded products returned');
    });

    await test('POST /api/products creates product with nested material recipe', async () => {
      // Get an inventory item to use in recipe
      const invRes = await request('/api/inventory', { token: adminToken });
      const firstItem = invRes.data.data[0];

      const res = await request('/api/products', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Premium Tri-Fold Catalog',
          category: 'Marketing',
          unit: '100 pcs',
          default_selling_price: 1500.0,
          materials: [
            {
              inventory_item_id: firstItem.id,
              quantity_required_per_unit: 1.5,
            },
          ],
        },
      });

      assertEqual(res.status, 201, 'Status 201 Created');
      assert(res.data.data.materials.length === 1, 'Material recipe attached');
      newProductId = res.data.data.id;
    });

    await test('GET /api/products/:id/material-requirements calculates raw material breakdown and stock sufficiency', async () => {
      // Find Visiting Cards product ID
      const prodRes = await request('/api/products', {
        token: adminToken,
        query: { search: 'Visiting Cards' },
      });
      const vcProduct = prodRes.data.data[0];

      const res = await request(`/api/products/${vcProduct.id}/material-requirements`, {
        token: adminToken,
        query: { quantity: '50' }, // 50 units
      });

      assertEqual(res.status, 200, 'Status 200');
      assertEqual(res.data.data.order_quantity, 50, 'Order quantity 50');
      assert(res.data.data.materials_breakdown.length > 0, 'Materials breakdown returned');
      assert(res.data.data.total_estimated_raw_material_cost > 0, 'Raw material cost calculated');
    });

    // ─── 4. INVENTORY & TRANSACTION AUDIT TRAIL ─────────────────────
    console.log('\n📦 Testing Module: INVENTORY & ATOMIC ADJUSTMENTS');

    let testItemId: number;

    await test('POST /api/inventory creates new item and logs initial inventory_transaction row', async () => {
      const res = await request('/api/inventory', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Gloss Lamination Roll 30 Micron',
          category: 'Finishing',
          unit: 'roll',
          current_quantity: 20,
          minimum_stock_level: 5,
          purchase_price: 850.0,
          average_cost: 850.0,
        },
      });

      assertEqual(res.status, 201, 'Status 201');
      assertEqual(parseFloat(res.data.data.current_quantity), 20, 'Current quantity is 20');
      testItemId = res.data.data.id;

      // Verify transaction row was automatically created in DB
      const txCheck = await pool.query(
        'SELECT * FROM inventory_transactions WHERE inventory_item_id = $1',
        [testItemId]
      );
      assert(txCheck.rows.length === 1, 'Inventory transaction row created automatically');
      assertEqual(parseFloat(txCheck.rows[0].quantity_change), 20, 'Quantity change is 20');
    });

    await test('POST /api/inventory/:id/adjust updates stock AND creates inventory_transactions audit record', async () => {
      const res = await request(`/api/inventory/${testItemId}/adjust`, {
        method: 'POST',
        token: adminToken,
        body: {
          quantity_change: -5,
          transaction_type: 'damaged',
          notes: '5 rolls damaged in storage',
        },
      });

      assertEqual(res.status, 200, 'Status 200');
      assertEqual(parseFloat(res.data.data.new_quantity), 15, 'New stock quantity updated to 15');
      assertEqual(res.data.data.transaction.transaction_type, 'damaged', 'Transaction type recorded');

      // Verify transactions endpoint
      const txRes = await request(`/api/inventory/${testItemId}/transactions`, {
        token: adminToken,
      });
      assertEqual(txRes.status, 200, 'Transactions status 200');
      assertEqual(txRes.data.data.length, 2, '2 transactions logged for this item');
    });

    await test('POST /api/inventory/:id/adjust BLOCKS negative stock without explicit override', async () => {
      // Item has 15 rolls. Try to remove 25 rolls.
      const res = await request(`/api/inventory/${testItemId}/adjust`, {
        method: 'POST',
        token: adminToken,
        body: {
          quantity_change: -25,
          transaction_type: 'manual_adjustment',
          notes: 'Should fail due to insufficient stock',
        },
      });

      assertEqual(res.status, 400, 'Status 400 Bad Request');
      assertEqual(res.data.error.code, 'INSUFFICIENT_STOCK_WARNING', 'Error code is INSUFFICIENT_STOCK_WARNING');
      assertEqual(res.data.error.details.current_quantity, 15, 'Current stock shown');
      assertEqual(res.data.error.details.resulting_quantity, -10, 'Resulting negative stock flagged');

      // Ensure DB stock was NOT changed
      const itemCheck = await pool.query(
        'SELECT current_quantity FROM inventory_items WHERE id = $1',
        [testItemId]
      );
      assertEqual(parseFloat(itemCheck.rows[0].current_quantity), 15, 'Database stock unchanged');
    });

    await test('POST /api/inventory/:id/adjust ALLOWS negative stock when allow_negative: true and valid reason provided', async () => {
      const res = await request(`/api/inventory/${testItemId}/adjust`, {
        method: 'POST',
        token: adminToken,
        body: {
          quantity_change: -25,
          transaction_type: 'manual_adjustment',
          allow_negative: true,
          reason: 'Emergency order fulfillment pending vendor delivery',
        },
      });

      assertEqual(res.status, 200, 'Status 200 Success');
      assertEqual(parseFloat(res.data.data.new_quantity), -10, 'Negative stock updated to -10');
      assert(res.data.warning !== undefined, 'Warning attached for negative stock override');

      // Verify DB updated
      const itemCheck = await pool.query(
        'SELECT current_quantity FROM inventory_items WHERE id = $1',
        [testItemId]
      );
      assertEqual(parseFloat(itemCheck.rows[0].current_quantity), -10, 'Database stock reflects -10');
    });

    await test('GET /api/inventory?filter=low_stock filters items below minimum stock level', async () => {
      const res = await request('/api/inventory', {
        token: adminToken,
        query: { filter: 'low_stock' },
      });

      assertEqual(res.status, 200, 'Status 200');
      assert(res.data.data.length >= 3, 'Returns seeded low stock items');
      for (const item of res.data.data) {
        assert(item.is_low_stock === true, 'All returned items are low stock');
      }
    });

    // ─── 5. SUPPLIERS CRUD ──────────────────────────────────────────
    console.log('\n📦 Testing Module: SUPPLIERS');

    let newSupplierId: number;

    await test('GET /api/suppliers returns suppliers list with supplied items count', async () => {
      const res = await request('/api/suppliers', { token: adminToken });
      assertEqual(res.status, 200, 'Status 200');
      assert(res.data.data.length >= 3, 'Seeded suppliers returned');
    });

    await test('POST /api/suppliers creates new supplier', async () => {
      const res = await request('/api/suppliers', {
        method: 'POST',
        token: adminToken,
        body: {
          name: `Jaipur Flex & Vinyl Supplies ${uniqueSuffix}`,
          contact_person: 'Ramesh Sharma',
          mobile: `941${uniqueSuffix}`,
          email: `sales_${uniqueSuffix}@jaipurflex.in`,
          address: 'Sitapura Industrial Area, Jaipur',
          gst_number: `08AAACJ${uniqueSuffix}`,
        },
      });

      assertEqual(res.status, 201, 'Status 201');
      newSupplierId = res.data.data.id;
    });

    await test('GET /api/suppliers/:id returns supplier details with supplied items and purchases', async () => {
      const res = await request(`/api/suppliers/${newSupplierId}`, { token: adminToken });
      assertEqual(res.status, 200, 'Status 200');
      assertEqual(res.data.data.name, `Jaipur Flex & Vinyl Supplies ${uniqueSuffix}`, 'Matches name');
    });

    // ─── 6. ROLE RESTRICTION: EMPLOYEE BLOCKED FROM DELETE ───────────
    console.log('\n📦 Testing Module: RBAC (EMPLOYEE DELETE RESTRICTION)');

    await test('DELETE /api/inventory/:id is FORBIDDEN (403) for employee role', async () => {
      const res = await request(`/api/inventory/${testItemId}`, {
        method: 'DELETE',
        token: employeeToken, // Logged in as Employee
      });

      assertEqual(res.status, 403, 'Employee blocked with 403 Forbidden');
      assertEqual(res.data.error.code, 'FORBIDDEN', 'Error code is FORBIDDEN');
    });

    await test('PUT /api/inventory/:id is ALLOWED for employee role (non-destructive)', async () => {
      const res = await request(`/api/inventory/${testItemId}`, {
        method: 'PUT',
        token: employeeToken,
        body: {
          notes: 'Updated note by employee',
        },
      });

      assertEqual(res.status, 200, 'Employee allowed to perform update');
    });

    await test('DELETE /api/clients/:id is rejected if client has historical orders (Database Policy Protection)', async () => {
      // Find ABC School ID (has orders)
      const clientsRes = await request('/api/clients/search', {
        token: adminToken,
        query: { q: 'ABC School' },
      });
      const abcId = clientsRes.data.data[0].id;

      const res = await request(`/api/clients/${abcId}`, {
        method: 'DELETE',
        token: adminToken,
      });

      assertEqual(res.status, 400, 'Blocked with 400 Bad Request');
      assertEqual(res.data.error.code, 'CLIENT_HAS_ORDERS', 'Error code CLIENT_HAS_ORDERS');
    });

    // ─── 7. ORDERS & PRODUCTION WORKFLOW TESTS ──────────────────────
    console.log('\n📦 Testing Module: ORDERS & PRODUCTION WORKFLOW');

    let workflowOrderId: number;
    let visitingCardsProductId: number;
    let cardStockInventoryId: number;
    let initialCardStockQty: number;

    await test('GET /api/orders lists seeded orders with filters and pagination', async () => {
      const res = await request('/api/orders', { token: adminToken });
      assertEqual(res.status, 200, 'Status 200');
      assert(res.data.data.length >= 15, 'Seeded orders returned');
      assert(res.data.pagination.total >= 15, 'Pagination total accurate');
    });

    await test('POST /api/orders creates order with multiple line items, calculated totals, and ZERO inventory impact', async () => {
      // 1. Get products (Visiting Cards and Flex Banners)
      const prodRes = await request('/api/products', { token: adminToken });
      const vcProd = prodRes.data.data.find((p: any) => p.name === 'Visiting Cards');
      const bannerProd = prodRes.data.data.find((p: any) => p.name === 'Flex Banners');
      visitingCardsProductId = vcProd.id;

      // 2. Record Card Stock inventory before order creation
      const invRes = await request('/api/inventory', { token: adminToken });
      const cardStock = invRes.data.data.find((i: any) => i.name.includes('Card Stock'));
      cardStockInventoryId = cardStock.id;
      initialCardStockQty = parseFloat(cardStock.current_quantity);

      // 3. Create order for 10 units of Visiting Cards + 50 sqft Banners
      const createRes = await request('/api/orders', {
        method: 'POST',
        token: adminToken,
        body: {
          client_id: createdClientId,
          items: [
            {
              product_id: vcProd.id,
              quantity: 10,
              unit_price: 250.0,
              discount: 100,
              tax: 432,
            },
            {
              product_id: bannerProd.id,
              quantity: 50,
              unit_price: 18.0,
              discount: 0,
              tax: 162,
            },
          ],
          notes: 'Test workflow order for print production',
        },
      });

      assertEqual(createRes.status, 201, 'Status 201 Created');
      assert(createRes.data.success === true, 'Success is true');
      assertEqual(createRes.data.data.production_status, 'received', 'Initial status is received');
      assertEqual(createRes.data.data.payment_status, 'unpaid', 'Initial payment status is unpaid');
      assertEqual(parseFloat(createRes.data.data.subtotal), 3400.0, 'Subtotal: (10*250) + (50*18) = 3400');
      assertEqual(parseFloat(createRes.data.data.discount), 100.0, 'Discount is 100');
      assertEqual(parseFloat(createRes.data.data.tax), 594.0, 'Tax is 594');
      assertEqual(parseFloat(createRes.data.data.total_amount), 3894.0, 'Total: 3400 - 100 + 594 = 3894');
      assert(createRes.data.data.items.length === 2, '2 line items inserted');

      workflowOrderId = createRes.data.data.id;

      // 4. Verify ZERO inventory impact at order creation
      const invAfter = await request(`/api/inventory/${cardStockInventoryId}`, { token: adminToken });
      assertEqual(
        parseFloat(invAfter.data.data.current_quantity),
        initialCardStockQty,
        'Card Stock quantity unchanged at order creation'
      );

      // Verify no order_consumption transaction exists for this order
      const txCheck = await pool.query(
        `SELECT * FROM inventory_transactions WHERE reference_type = 'order' AND reference_id = $1`,
        [workflowOrderId]
      );
      assertEqual(txCheck.rows.length, 0, 'Zero inventory transactions created on order placement');
    });

    await test('GET /api/orders/:id/material-requirements calculates raw material breakdown accurately', async () => {
      const res = await request(`/api/orders/${workflowOrderId}/material-requirements`, {
        token: adminToken,
      });

      assertEqual(res.status, 200, 'Status 200');
      assert(res.data.data.materials_breakdown.length >= 2, 'Includes materials for cards and banners');
      assert(res.data.data.total_raw_material_cost > 0, 'Calculates estimated material cost');
    });

    await test('POST /api/orders/:id/status transitions to "production", deducts stock, and logs inventory_transactions', async () => {
      const res = await request(`/api/orders/${workflowOrderId}/status`, {
        method: 'POST',
        token: adminToken,
        body: {
          status: 'production',
          notes: 'Started printing on Heidelberg press',
        },
      });

      assertEqual(res.status, 200, 'Status 200');
      assertEqual(res.data.data.production_status, 'production', 'Status updated to production');

      // Verify inventory stock was deducted (10 units * 10 sheets per unit = 100 sheets of card stock)
      const invAfter = await request(`/api/inventory/${cardStockInventoryId}`, { token: adminToken });
      assertEqual(
        parseFloat(invAfter.data.data.current_quantity),
        initialCardStockQty - 100,
        'Card stock deducted by 100 sheets upon entering production'
      );

      // Verify order_consumption transactions logged
      const txCheck = await pool.query(
        `SELECT * FROM inventory_transactions 
         WHERE reference_type = 'order' AND reference_id = $1 AND transaction_type = 'order_consumption'`,
        [workflowOrderId]
      );
      assert(txCheck.rows.length >= 2, 'Logged consumption transactions for each recipe material');
      assert(parseFloat(txCheck.rows[0].quantity_change) < 0, 'Quantity change is negative');
    });

    await test('POST /api/orders/:id/status rejects invalid backward transitions (e.g. from production to received)', async () => {
      const res = await request(`/api/orders/${workflowOrderId}/status`, {
        method: 'POST',
        token: adminToken,
        body: {
          status: 'received',
        },
      });

      assertEqual(res.status, 400, 'Status 400 Bad Request');
      assertEqual(res.data.error.code, 'INVALID_STATUS_TRANSITION', 'Invalid transition error code');
    });

    await test('POST /api/orders/:id/status BLOCKS entering production when stock is INSUFFICIENT without force', async () => {
      // 1. Create an order with massive quantity that exceeds available inventory (5,000 units = 50,000 card stock sheets)
      const massiveOrderRes = await request('/api/orders', {
        method: 'POST',
        token: adminToken,
        body: {
          client_id: createdClientId,
          items: [
            {
              product_id: visitingCardsProductId,
              quantity: 5000,
            },
          ],
        },
      });
      const massiveOrderId = massiveOrderRes.data.data.id;

      // 2. Attempt to move into production without force
      const moveRes = await request(`/api/orders/${massiveOrderId}/status`, {
        method: 'POST',
        token: adminToken,
        body: {
          status: 'production',
        },
      });

      assertEqual(moveRes.status, 409, 'Status 409 Conflict');
      assertEqual(moveRes.data.error.code, 'INSUFFICIENT_STOCK_FOR_PRODUCTION', 'Insufficient stock error code');
      assert(moveRes.data.error.details.shortfalls.length > 0, 'Shortfall details provided in error response');

      // 3. Confirm order status remained 'received'
      const orderCheck = await request(`/api/orders/${massiveOrderId}`, { token: adminToken });
      assertEqual(orderCheck.data.data.production_status, 'received', 'Order status was not changed');

      // 4. Entering production with force: true and valid reason succeeds
      const forceRes = await request(`/api/orders/${massiveOrderId}/status`, {
        method: 'POST',
        token: adminToken,
        body: {
          status: 'production',
          force: true,
          reason: 'VIP government client — paper delivery arriving tonight',
        },
      });

      assertEqual(forceRes.status, 200, 'Status 200 with force override');
      assertEqual(forceRes.data.data.production_status, 'production', 'Status updated to production');
      assert(forceRes.data.warning !== undefined, 'Warning attached indicating forced negative stock');
    });

    await test('PUT /api/orders/:id allows editing line items in pre-production, but BLOCKS line item edits in production', async () => {
      // Create a fresh pre-production order
      const preProdRes = await request('/api/orders', {
        method: 'POST',
        token: adminToken,
        body: {
          client_id: createdClientId,
          items: [{ product_id: visitingCardsProductId, quantity: 5 }],
        },
      });
      const preProdId = preProdRes.data.data.id;

      // Edit pre-production line items -> SUT succeeds
      const editPreRes = await request(`/api/orders/${preProdId}`, {
        method: 'PUT',
        token: adminToken,
        body: {
          items: [{ product_id: visitingCardsProductId, quantity: 8 }],
        },
      });
      assertEqual(editPreRes.status, 200, 'Edit in pre-production succeeds');
      assertEqual(parseFloat(editPreRes.data.data.items[0].quantity), 8, 'Quantity updated to 8');

      // Attempt to edit line items on workflowOrderId (which is in 'production') -> MUST FAIL
      const editPostRes = await request(`/api/orders/${workflowOrderId}`, {
        method: 'PUT',
        token: adminToken,
        body: {
          items: [{ product_id: visitingCardsProductId, quantity: 15 }],
        },
      });
      assertEqual(editPostRes.status, 400, 'Status 400 Bad Request');
      assertEqual(editPostRes.data.error.code, 'ORDER_LOCKED_POST_PRODUCTION', 'Locked post production code');
    });

    await test('POST /api/orders/:id/cancel cancels a pre-production order with ZERO inventory impact', async () => {
      // Create a pre-production order
      const draftOrderRes = await request('/api/orders', {
        method: 'POST',
        token: adminToken,
        body: {
          client_id: createdClientId,
          items: [{ product_id: visitingCardsProductId, quantity: 2 }],
        },
      });
      const draftId = draftOrderRes.data.data.id;

      const cancelRes = await request(`/api/orders/${draftId}/cancel`, {
        method: 'POST',
        token: adminToken,
        body: { notes: 'Client requested cancellation before design' },
      });

      assertEqual(cancelRes.status, 200, 'Status 200');
      assertEqual(cancelRes.data.data.production_status, 'cancelled', 'Status is cancelled');
      assertEqual(cancelRes.data.data.has_consumed_inventory, false, 'No inventory was consumed');

      // Attempting to restore inventory on a non-consumed order fails gracefully
      const restoreRes = await request(`/api/orders/${draftId}/restore-inventory`, {
        method: 'POST',
        token: adminToken,
      });
      assertEqual(restoreRes.status, 400, 'Status 400');
      assertEqual(restoreRes.data.error.code, 'NO_INVENTORY_CONSUMED', 'NO_INVENTORY_CONSUMED error code');
    });

    await test('POST /api/orders/:id/restore-inventory restores quantities for cancelled post-production order and preserves audit history', async () => {
      // 1. Cancel workflowOrderId (which consumed inventory in production)
      const cancelRes = await request(`/api/orders/${workflowOrderId}/cancel`, {
        method: 'POST',
        token: adminToken,
        body: { notes: 'Client cancelled during printing stage' },
      });
      assertEqual(cancelRes.status, 200, 'Order cancelled');
      assertEqual(cancelRes.data.data.can_restore_inventory, true, 'Can restore inventory is true');

      // 2. Check stock before restore
      const stockBefore = await request(`/api/inventory/${cardStockInventoryId}`, { token: adminToken });
      const qtyBeforeRestore = parseFloat(stockBefore.data.data.current_quantity);

      // 3. Call restore-inventory
      const restoreRes = await request(`/api/orders/${workflowOrderId}/restore-inventory`, {
        method: 'POST',
        token: adminToken,
      });

      assertEqual(restoreRes.status, 200, 'Status 200');
      assert(restoreRes.data.data.restored_items_count >= 2, 'Restored consumed materials');

      // 4. Verify stock was added back (100 card stock sheets returned)
      const stockAfter = await request(`/api/inventory/${cardStockInventoryId}`, { token: adminToken });
      assertEqual(
        parseFloat(stockAfter.data.data.current_quantity),
        qtyBeforeRestore + 100,
        'Card stock incremented by 100 sheets'
      );

      // 5. Verify original consumption records are STILL PRESERVED and offsetting 'return' records exist
      const allTxRes = await pool.query(
        `SELECT transaction_type, quantity_change, reference_type 
         FROM inventory_transactions 
         WHERE reference_id = $1 
         ORDER BY id ASC`,
        [workflowOrderId]
      );
      const consumptionRows = allTxRes.rows.filter((r) => r.transaction_type === 'order_consumption');
      const returnRows = allTxRes.rows.filter((r) => r.transaction_type === 'return');
      assert(consumptionRows.length >= 2, 'Original order_consumption rows still intact');
      assert(returnRows.length >= 2, 'Offsetting return rows logged');

      // 6. Double restoration is blocked
      const doubleRestore = await request(`/api/orders/${workflowOrderId}/restore-inventory`, {
        method: 'POST',
        token: adminToken,
      });
      assertEqual(doubleRestore.status, 400, 'Status 400 on duplicate restore attempt');
      assertEqual(doubleRestore.data.error.code, 'INVENTORY_ALREADY_RESTORED', 'INVENTORY_ALREADY_RESTORED code');
    });

    await test('POST /api/orders/:id/duplicate implements repeat-order: creates new draft order without mutating the original', async () => {
      // Find ORD-1001 (ABC School first order)
      const ordersRes = await request('/api/orders', {
        token: adminToken,
        query: { search: 'ORD-1001' },
      });
      const originalOrder = ordersRes.data.data[0];

      // Duplicate it
      const dupRes = await request(`/api/orders/${originalOrder.id}/duplicate`, {
        method: 'POST',
        token: adminToken,
      });

      assertEqual(dupRes.status, 201, 'Status 201 Created');
      const duplicatedOrder = dupRes.data.data;

      // Assert new order properties
      assert(duplicatedOrder.id !== originalOrder.id, 'New unique order ID');
      assert(duplicatedOrder.order_number !== originalOrder.order_number, 'New order number generated');
      assertEqual(duplicatedOrder.production_status, 'received', 'Status reset to received');
      assertEqual(duplicatedOrder.payment_status, 'unpaid', 'Payment status reset to unpaid');
      assertEqual(duplicatedOrder.client_id, originalOrder.client_id, 'Client ID copied');
      assertEqual(duplicatedOrder.items.length, originalOrder.items_count, 'Line items copied');
      assertEqual(parseFloat(duplicatedOrder.total_amount), parseFloat(originalOrder.total_amount), 'Pricing matches');

      // Assert original order is COMPLETELY UNTOUCHED
      const checkOriginal = await request(`/api/orders/${originalOrder.id}`, { token: adminToken });
      assertEqual(checkOriginal.data.data.order_number, 'ORD-1001', 'Original order number intact');
      assertEqual(checkOriginal.data.data.production_status, originalOrder.production_status, 'Original status intact');
      assertEqual(checkOriginal.data.data.payment_status, originalOrder.payment_status, 'Original payment status intact');
    });

    await test('GET /api/orders/:id/profitability returns selling revenue, consumption material cost, gross profit, and margin %', async () => {
      // Test on ORD-1001 (ABC School)
      const ordersRes = await request('/api/orders', {
        token: adminToken,
        query: { search: 'ORD-1001' },
      });
      const order = ordersRes.data.data[0];

      const res = await request(`/api/orders/${order.id}/profitability`, { token: adminToken });
      assertEqual(res.status, 200, 'Status 200');
      assert(res.data.data.financials.subtotal_revenue > 0, 'Subtotal revenue calculated');
      assert(res.data.data.financials.total_material_cost > 0, 'Total material cost computed');
      assert(res.data.data.financials.gross_profit > 0, 'Gross profit computed');
      assert(res.data.data.financials.gross_margin_percentage > 0, 'Gross margin percentage computed');
      assert(res.data.data.materials_cost_breakdown.length > 0, 'Materials cost breakdown provided');
    });

  } finally {
    // Cleanup temporary server and DB pool
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }

  console.log('\n========================================');
  console.log(`📊 Test Results: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
