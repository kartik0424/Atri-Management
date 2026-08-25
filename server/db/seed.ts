/**
 * Seed script — populates the database with realistic demo data for a
 * printing business. Run AFTER migrations.
 *
 * Data includes:
 *  - 3 users (admin, manager, employee)
 *  - 5 clients (mixed types)
 *  - 3 suppliers
 *  - 10 inventory items (some below minimum stock)
 *  - 8 products with material recipes
 *  - 15 orders (including ABC School repeat-order scenario)
 *  - Matching payments, status history, inventory transactions
 *  - 5 purchases with purchase items
 *  - 6 expenses
 */
import path from 'node:path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Helper — hash a password
async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Helper — insert and return the id
async function insertReturningId(sql: string, params: unknown[]): Promise<number> {
  const result = await pool.query(sql + ' RETURNING id', params);
  return result.rows[0].id;
}

async function seed() {
  console.log('🌱 Seeding database...\n');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ─── USERS ───────────────────────────────────────────────────
    console.log('  👤 Creating users...');
    const pw = await hash('password123');

    const userAdmin = (await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Kartik Sharma', 'kartik@atrimanagement.com', pw, 'admin']
    )).rows[0].id;

    const userManager = (await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Priya Mehta', 'priya@atrimanagement.com', pw, 'manager']
    )).rows[0].id;

    const userEmployee = (await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Ravi Kumar', 'ravi@atrimanagement.com', pw, 'employee']
    )).rows[0].id;

    // ─── CLIENTS ─────────────────────────────────────────────────
    console.log('  🏢 Creating clients...');

    const clientABC = (await client.query(
      `INSERT INTO clients (name, contact_person, mobile, email, address, gst_number, client_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      ['ABC School', 'Mrs. Sunita Verma', '9876543210', 'admin@abcschool.edu.in',
       '45 Education Lane, Civil Lines, Jaipur 302001', '08AABCU9603R1ZM', 'school',
       'Regular client — bulk ID cards and certificates every semester']
    )).rows[0].id;

    const clientSunrise = (await client.query(
      `INSERT INTO clients (name, contact_person, mobile, email, address, gst_number, client_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      ['Sunrise Printers', 'Anil Gupta', '9123456789', 'anil@sunriseprinters.com',
       '12 Industrial Area, Phase II, Jaipur 302022', '08AABCS5678R1ZN', 'company',
       'Outsources large-format banner printing to us']
    )).rows[0].id;

    const clientRaj = (await client.query(
      `INSERT INTO clients (name, contact_person, mobile, email, address, client_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['Raj Kumar', 'Raj Kumar', '9988776655', 'raj.kumar@gmail.com',
       '789 MG Road, Jaipur 302015', 'individual',
       'Wedding invitation orders, price-sensitive']
    )).rows[0].id;

    const clientCollege = (await client.query(
      `INSERT INTO clients (name, contact_person, mobile, email, address, gst_number, client_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      ['City Engineering College', 'Dr. Ramesh Patel', '9011223344', 'office@cityengg.ac.in',
       '100 University Road, Mansarovar, Jaipur 302020', '08AABCC1234R1ZP', 'college',
       'Annual brochures, certificates, and ID cards']
    )).rows[0].id;

    const clientGovt = (await client.query(
      `INSERT INTO clients (name, contact_person, mobile, email, address, gst_number, client_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      ['District Collector Office', 'Shri M.K. Singh (PA)', '9555444333', 'dc.jaipur@rajasthan.gov.in',
       'Collectorate, MI Road, Jaipur 302001', '08AABCG9999R1ZQ', 'government',
       'Government forms, letterheads — payment cycle 30-45 days']
    )).rows[0].id;

    // Client contacts for ABC School
    await client.query(
      `INSERT INTO client_contacts (client_id, name, designation, mobile, email, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [clientABC, 'Mrs. Sunita Verma', 'Principal', '9876543210', 'principal@abcschool.edu.in', true]
    );
    await client.query(
      `INSERT INTO client_contacts (client_id, name, designation, mobile, email, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [clientABC, 'Mr. Deepak Joshi', 'Office Manager', '9876543211', 'office@abcschool.edu.in', false]
    );

    // ─── SUPPLIERS ───────────────────────────────────────────────
    console.log('  📦 Creating suppliers...');

    const supplierPaper = (await client.query(
      `INSERT INTO suppliers (name, contact_person, mobile, email, address, gst_number, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['Rajasthan Paper Mills', 'Vikram Singh', '9001122334', 'sales@rajpapermills.com',
       'RIICO Industrial Area, Sitapura, Jaipur', '08AABCR1111R1ZA',
       'Primary paper supplier — good rates on bulk orders']
    )).rows[0].id;

    const supplierInk = (await client.query(
      `INSERT INTO suppliers (name, contact_person, mobile, email, address, gst_number, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['Shree Ink & Toner', 'Mahesh Agarwal', '9002233445', 'mahesh@shreeink.com',
       'Nehru Bazaar, Jaipur', '08AABCS2222R1ZB',
       'Ink cartridges and toner — next-day delivery']
    )).rows[0].id;

    const supplierPackaging = (await client.query(
      `INSERT INTO suppliers (name, contact_person, mobile, email, address, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      ['National Packaging Co.', 'Suresh Bhatia', '9003344556', 'suresh@natpack.in',
       'Transport Nagar, Jaipur',
       'Boxes, lamination film, binding materials']
    )).rows[0].id;

    // ─── INVENTORY ITEMS ─────────────────────────────────────────
    console.log('  📋 Creating inventory items...');

    const invPaperA4 = (await client.query(
      `INSERT INTO inventory_items (name, category, unit, current_quantity, minimum_stock_level, purchase_price, average_cost, supplier_id, storage_location, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      ['A4 Paper (75 GSM)', 'Paper', 'ream', 120, 50, 180.00, 175.00, supplierPaper, 'Rack A-1', 'Standard copier paper']
    )).rows[0].id;

    const invPaperA3 = (await client.query(
      `INSERT INTO inventory_items (name, category, unit, current_quantity, minimum_stock_level, purchase_price, average_cost, supplier_id, storage_location, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      ['A3 Paper (90 GSM)', 'Paper', 'ream', 30, 20, 320.00, 310.00, supplierPaper, 'Rack A-2', 'For brochures and certificates']
    )).rows[0].id;

    const invCardStock = (await client.query(
      `INSERT INTO inventory_items (name, category, unit, current_quantity, minimum_stock_level, purchase_price, average_cost, supplier_id, storage_location, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      ['Card Stock (300 GSM)', 'Paper', 'sheet', 800, 500, 5.50, 5.25, supplierPaper, 'Rack A-3', 'For visiting cards and ID cards']
    )).rows[0].id;

    const invInkBlack = (await client.query(
      `INSERT INTO inventory_items (name, category, unit, current_quantity, minimum_stock_level, purchase_price, average_cost, supplier_id, storage_location, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      ['Ink Cartridge — Black', 'Ink', 'cartridge', 3, 5, 1200.00, 1150.00, supplierInk, 'Cabinet B-1', 'HP 678 compatible — LOW STOCK']
    )).rows[0].id; // Below minimum!

    const invInkColor = (await client.query(
      `INSERT INTO inventory_items (name, category, unit, current_quantity, minimum_stock_level, purchase_price, average_cost, supplier_id, storage_location, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      ['Ink Cartridge — Color (CMY)', 'Ink', 'cartridge', 2, 4, 1800.00, 1750.00, supplierInk, 'Cabinet B-1', 'Tri-color — LOW STOCK']
    )).rows[0].id; // Below minimum!

    const invToner = (await client.query(
      `INSERT INTO inventory_items (name, category, unit, current_quantity, minimum_stock_level, purchase_price, average_cost, supplier_id, storage_location, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      ['Toner — Black (Laser)', 'Ink', 'unit', 4, 3, 2500.00, 2450.00, supplierInk, 'Cabinet B-2', 'For laser printer']
    )).rows[0].id;

    const invLamination = (await client.query(
      `INSERT INTO inventory_items (name, category, unit, current_quantity, minimum_stock_level, purchase_price, average_cost, supplier_id, storage_location, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      ['Lamination Film (A4)', 'Finishing', 'meter', 45, 50, 12.00, 11.50, supplierPackaging, 'Rack C-1', 'Glossy lamination — LOW STOCK']
    )).rows[0].id; // Below minimum!

    const invBinding = (await client.query(
      `INSERT INTO inventory_items (name, category, unit, current_quantity, minimum_stock_level, purchase_price, average_cost, supplier_id, storage_location, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      ['Spiral Binding Ring', 'Finishing', 'piece', 200, 100, 8.00, 7.50, supplierPackaging, 'Rack C-2', 'Assorted sizes']
    )).rows[0].id;

    const invBannerVinyl = (await client.query(
      `INSERT INTO inventory_items (name, category, unit, current_quantity, minimum_stock_level, purchase_price, average_cost, supplier_id, storage_location, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      ['Banner Vinyl (Flex)', 'Large Format', 'sqft', 150, 100, 15.00, 14.50, supplierPackaging, 'Roll Stand D-1', '13 oz matte flex']
    )).rows[0].id;

    const invEnvelope = (await client.query(
      `INSERT INTO inventory_items (name, category, unit, current_quantity, minimum_stock_level, purchase_price, average_cost, supplier_id, storage_location, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      ['Envelope (White, 10x12)', 'Packaging', 'piece', 500, 200, 3.00, 2.80, supplierPackaging, 'Rack C-3', 'Standard mailing envelopes']
    )).rows[0].id;

    // ─── PRODUCTS ────────────────────────────────────────────────
    console.log('  🖨️  Creating products...');

    const prodVisitingCards = (await client.query(
      `INSERT INTO products (name, category, unit, default_selling_price)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      ['Visiting Cards', 'Cards', '100 cards', 250.00]
    )).rows[0].id;

    const prodLetterheads = (await client.query(
      `INSERT INTO products (name, category, unit, default_selling_price)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      ['Letterheads', 'Stationery', '100 sheets', 450.00]
    )).rows[0].id;

    const prodBrochures = (await client.query(
      `INSERT INTO products (name, category, unit, default_selling_price)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      ['Brochures (A4, Trifold)', 'Marketing', '100 pieces', 1200.00]
    )).rows[0].id;

    const prodBanners = (await client.query(
      `INSERT INTO products (name, category, unit, default_selling_price)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      ['Flex Banners', 'Large Format', 'sqft', 18.00]
    )).rows[0].id;

    const prodIDCards = (await client.query(
      `INSERT INTO products (name, category, unit, default_selling_price)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      ['ID Cards (PVC)', 'Cards', 'card', 35.00]
    )).rows[0].id;

    const prodCertificates = (await client.query(
      `INSERT INTO products (name, category, unit, default_selling_price)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      ['Certificates (A4, Color)', 'Stationery', 'piece', 25.00]
    )).rows[0].id;

    const prodWeddingInvites = (await client.query(
      `INSERT INTO products (name, category, unit, default_selling_price)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      ['Wedding Invitations', 'Premium', 'card', 45.00]
    )).rows[0].id;

    const prodBillBooks = (await client.query(
      `INSERT INTO products (name, category, unit, default_selling_price)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      ['Bill Books (Duplicate)', 'Stationery', 'book', 120.00]
    )).rows[0].id;

    // ─── PRODUCT MATERIALS (Recipes / BOM) ───────────────────────
    console.log('  🧪 Creating product material recipes...');

    // Visiting Cards: card stock + ink (color)
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodVisitingCards, invCardStock, 10]  // 10 sheets per 100 cards
    );
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodVisitingCards, invInkColor, 0.05]
    );

    // Letterheads: A4 paper + toner
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodLetterheads, invPaperA4, 0.2]  // 1/5 ream per 100 sheets
    );
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodLetterheads, invToner, 0.02]
    );

    // Brochures: A3 paper + ink color + lamination
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodBrochures, invPaperA3, 0.5]
    );
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodBrochures, invInkColor, 0.1]
    );
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodBrochures, invLamination, 2.0]
    );

    // Banners: vinyl + ink color
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodBanners, invBannerVinyl, 1.0]
    );
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodBanners, invInkColor, 0.02]
    );

    // ID Cards: card stock + ink color + lamination
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodIDCards, invCardStock, 1]
    );
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodIDCards, invInkColor, 0.01]
    );
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodIDCards, invLamination, 0.3]
    );

    // Certificates: A4 paper + ink color
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodCertificates, invPaperA4, 0.002]
    );
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodCertificates, invInkColor, 0.005]
    );

    // Wedding Invitations: card stock + ink color + envelope
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodWeddingInvites, invCardStock, 2]
    );
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodWeddingInvites, invInkColor, 0.015]
    );
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodWeddingInvites, invEnvelope, 1]
    );

    // Bill Books: A4 paper + toner + binding
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodBillBooks, invPaperA4, 0.1]
    );
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodBillBooks, invToner, 0.01]
    );
    await client.query(
      `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit) VALUES ($1,$2,$3)`,
      [prodBillBooks, invBinding, 1]
    );

    // ─── ORDERS ──────────────────────────────────────────────────
    console.log('  📝 Creating orders...');

    // Helper to create an order and its items + initial status history
    async function createOrder(
      orderNumber: string, clientId: number, orderDate: string,
      expectedDelivery: string | null, items: { productId: number; qty: number; unitPrice: number; discount: number; tax: number }[],
      paymentStatus: string, productionStatus: string,
      notes: string | null, createdBy: number
    ): Promise<number> {
      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;
      for (const item of items) {
        const lineTotal = (item.qty * item.unitPrice) - item.discount + item.tax;
        subtotal += item.qty * item.unitPrice;
        totalDiscount += item.discount;
        totalTax += item.tax;
      }
      const totalAmount = subtotal - totalDiscount + totalTax;

      const orderId = (await client.query(
        `INSERT INTO orders (order_number, client_id, order_date, expected_delivery_date, subtotal, discount, tax, total_amount, payment_status, production_status, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [orderNumber, clientId, orderDate, expectedDelivery, subtotal, totalDiscount, totalTax, totalAmount, paymentStatus, productionStatus, notes, createdBy]
      )).rows[0].id;

      // Insert order items
      for (const item of items) {
        const lineTotal = (item.qty * item.unitPrice) - item.discount + item.tax;
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount, tax, line_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [orderId, item.productId, item.qty, item.unitPrice, item.discount, item.tax, lineTotal]
        );
      }

      // Initial status history
      await client.query(
        `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes)
         VALUES ($1, 'received', $2, $3, 'Order received')`,
        [orderId, createdBy, orderDate]
      );

      return orderId;
    }

    // --- ABC School repeat-order scenario ---
    // Order 1: 10 Visiting Cards — delivered, paid
    const ord1 = await createOrder(
      'ORD-1001', clientABC, '2026-06-10', '2026-06-15',
      [{ productId: prodVisitingCards, qty: 10, unitPrice: 250.00, discount: 0, tax: 450.00 }],
      'paid', 'delivered', 'First batch of visiting cards for teachers', userAdmin
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord1, 'production', userEmployee, '2026-06-11', 'Started printing']
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord1, 'delivered', userManager, '2026-06-14', 'Delivered to school office']
    );

    // Order 2: 12 Visiting Cards — in production, partially paid
    const ord2 = await createOrder(
      'ORD-1005', clientABC, '2026-07-20', '2026-07-28',
      [{ productId: prodVisitingCards, qty: 12, unitPrice: 250.00, discount: 200, tax: 522.00 }],
      'partially_paid', 'production', 'Second batch — updated design for new staff', userManager
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord2, 'design', userEmployee, '2026-07-21', 'Design revision requested']
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord2, 'production', userEmployee, '2026-07-23', 'Design approved, printing started']
    );

    // Order 3: 8 Visiting Cards — just received, unpaid
    const ord3 = await createOrder(
      'ORD-1012', clientABC, '2026-08-22', '2026-08-30',
      [{ productId: prodVisitingCards, qty: 8, unitPrice: 250.00, discount: 0, tax: 360.00 }],
      'unpaid', 'received', 'Third batch — replacement cards', userEmployee
    );

    // --- Sunrise Printers orders ---
    const ord4 = await createOrder(
      'ORD-1002', clientSunrise, '2026-06-15', '2026-06-22',
      [{ productId: prodBanners, qty: 200, unitPrice: 18.00, discount: 100, tax: 648.00 }],
      'paid', 'delivered', '200 sqft flex banner for Diwali sale', userAdmin
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord4, 'production', userEmployee, '2026-06-16', null]
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord4, 'delivered', userManager, '2026-06-21', 'Delivered with installation']
    );

    const ord5 = await createOrder(
      'ORD-1008', clientSunrise, '2026-08-01', '2026-08-10',
      [
        { productId: prodBrochures, qty: 5, unitPrice: 1200.00, discount: 300, tax: 1062.00 },
        { productId: prodLetterheads, qty: 3, unitPrice: 450.00, discount: 0, tax: 243.00 },
      ],
      'paid', 'delivered', 'Brochures + Letterheads combo', userManager
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord5, 'delivered', userManager, '2026-08-08', null]
    );

    // --- Raj Kumar orders ---
    const ord6 = await createOrder(
      'ORD-1003', clientRaj, '2026-06-25', '2026-07-10',
      [{ productId: prodWeddingInvites, qty: 200, unitPrice: 45.00, discount: 500, tax: 1602.00 }],
      'paid', 'delivered', 'Wedding invitations — premium gold foil design', userAdmin
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord6, 'design', userEmployee, '2026-06-26', 'Custom design with bride & groom names']
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord6, 'production', userEmployee, '2026-06-30', null]
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord6, 'quality_check', userManager, '2026-07-05', 'Checking foil quality']
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord6, 'delivered', userManager, '2026-07-08', 'Delivered with envelopes']
    );

    const ord7 = await createOrder(
      'ORD-1010', clientRaj, '2026-08-15', '2026-08-25',
      [{ productId: prodVisitingCards, qty: 5, unitPrice: 250.00, discount: 0, tax: 225.00 }],
      'unpaid', 'design', 'Personal visiting cards — minimalist design', userEmployee
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord7, 'design', userEmployee, '2026-08-16', 'Design in progress']
    );

    // --- City Engineering College orders ---
    const ord8 = await createOrder(
      'ORD-1004', clientCollege, '2026-06-28', '2026-07-15',
      [
        { productId: prodIDCards, qty: 500, unitPrice: 35.00, discount: 1000, tax: 3060.00 },
        { productId: prodCertificates, qty: 200, unitPrice: 25.00, discount: 0, tax: 900.00 },
      ],
      'paid', 'delivered', 'Semester ID cards + Merit certificates', userAdmin
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord8, 'delivered', userManager, '2026-07-12', null]
    );

    const ord9 = await createOrder(
      'ORD-1009', clientCollege, '2026-08-05', '2026-08-20',
      [{ productId: prodBrochures, qty: 10, unitPrice: 1200.00, discount: 500, tax: 2106.00 }],
      'partially_paid', 'quality_check', 'College fest brochures', userManager
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord9, 'production', userEmployee, '2026-08-07', null]
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord9, 'quality_check', userManager, '2026-08-18', 'Color proofing']
    );

    // --- District Collector Office orders ---
    const ord10 = await createOrder(
      'ORD-1006', clientGovt, '2026-07-05', '2026-07-20',
      [
        { productId: prodLetterheads, qty: 20, unitPrice: 450.00, discount: 0, tax: 1620.00 },
        { productId: prodBillBooks, qty: 10, unitPrice: 120.00, discount: 0, tax: 216.00 },
      ],
      'paid', 'delivered', 'Government letterheads and bill books', userAdmin
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord10, 'delivered', userManager, '2026-07-18', null]
    );

    const ord11 = await createOrder(
      'ORD-1007', clientGovt, '2026-07-15', '2026-08-01',
      [{ productId: prodBanners, qty: 100, unitPrice: 18.00, discount: 0, tax: 324.00 }],
      'unpaid', 'ready', 'Independence Day event banners', userManager
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord11, 'production', userEmployee, '2026-07-17', null]
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, changed_at, notes) VALUES ($1,$2,$3,$4,$5)`,
      [ord11, 'ready', userManager, '2026-07-28', 'Ready for pickup']
    );

    // More misc orders to reach 15
    const ord12 = await createOrder(
      'ORD-1011', clientRaj, '2026-08-18', '2026-08-28',
      [{ productId: prodBillBooks, qty: 5, unitPrice: 120.00, discount: 0, tax: 108.00 }],
      'unpaid', 'received', 'Bill books for shop', userEmployee
    );

    const ord13 = await createOrder(
      'ORD-1013', clientSunrise, '2026-08-23', '2026-09-05',
      [
        { productId: prodBanners, qty: 300, unitPrice: 18.00, discount: 200, tax: 968.00 },
        { productId: prodVisitingCards, qty: 20, unitPrice: 250.00, discount: 500, tax: 810.00 },
      ],
      'unpaid', 'received', 'Large banner order + visiting cards combo', userAdmin
    );

    const ord14 = await createOrder(
      'ORD-1014', clientCollege, '2026-08-24', '2026-09-10',
      [{ productId: prodIDCards, qty: 300, unitPrice: 35.00, discount: 500, tax: 1872.00 }],
      'unpaid', 'received', 'New semester ID cards batch', userManager
    );

    const ord15 = await createOrder(
      'ORD-1015', clientGovt, '2026-08-25', '2026-09-15',
      [
        { productId: prodLetterheads, qty: 10, unitPrice: 450.00, discount: 0, tax: 810.00 },
        { productId: prodCertificates, qty: 100, unitPrice: 25.00, discount: 0, tax: 450.00 },
      ],
      'unpaid', 'received', 'Quarterly stationery replenishment', userAdmin
    );

    // ─── PAYMENTS ────────────────────────────────────────────────
    console.log('  💰 Creating payments...');

    // ORD-1001 (ABC School, ₹2950) — fully paid
    await client.query(
      `INSERT INTO payments (order_id, amount, payment_method, payment_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [ord1, 2950.00, 'upi', '2026-06-14', 'Full payment via Google Pay', userAdmin]
    );

    // ORD-1005 (ABC School, ₹3322) — partially paid
    await client.query(
      `INSERT INTO payments (order_id, amount, payment_method, payment_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [ord2, 2000.00, 'cash', '2026-07-22', 'Advance payment', userManager]
    );

    // ORD-1002 (Sunrise, ₹4148) — fully paid
    await client.query(
      `INSERT INTO payments (order_id, amount, payment_method, payment_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [ord4, 4148.00, 'bank_transfer', '2026-06-22', 'NEFT payment', userAdmin]
    );

    // ORD-1008 (Sunrise, ₹7355) — fully paid in two parts
    await client.query(
      `INSERT INTO payments (order_id, amount, payment_method, payment_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [ord5, 4000.00, 'upi', '2026-08-02', 'Advance', userManager]
    );
    await client.query(
      `INSERT INTO payments (order_id, amount, payment_method, payment_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [ord5, 3355.00, 'upi', '2026-08-09', 'Balance cleared', userManager]
    );

    // ORD-1003 (Raj — wedding, ₹10102) — fully paid
    await client.query(
      `INSERT INTO payments (order_id, amount, payment_method, payment_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [ord6, 5000.00, 'cash', '2026-06-25', 'Advance at order', userAdmin]
    );
    await client.query(
      `INSERT INTO payments (order_id, amount, payment_method, payment_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [ord6, 5102.00, 'upi', '2026-07-08', 'Balance on delivery', userAdmin]
    );

    // ORD-1004 (College, ₹20460) — fully paid
    await client.query(
      `INSERT INTO payments (order_id, amount, payment_method, payment_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [ord8, 20460.00, 'bank_transfer', '2026-07-15', 'College cheque cleared', userAdmin]
    );

    // ORD-1009 (College, ₹13606) — partially paid
    await client.query(
      `INSERT INTO payments (order_id, amount, payment_method, payment_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [ord9, 7000.00, 'bank_transfer', '2026-08-06', 'Advance from college', userManager]
    );

    // ORD-1006 (Govt, ₹11036) — fully paid
    await client.query(
      `INSERT INTO payments (order_id, amount, payment_method, payment_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [ord10, 11036.00, 'bank_transfer', '2026-08-10', 'Government payment — 30 day cycle', userAdmin]
    );

    // ─── PURCHASES ───────────────────────────────────────────────
    console.log('  🛒 Creating purchases...');

    // Purchase 1 — Paper from Rajasthan Paper Mills
    const purch1 = (await client.query(
      `INSERT INTO purchases (supplier_id, date, total_amount, invoice_number, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [supplierPaper, '2026-06-01', 18000.00, 'RPM-2026-0542', '100 reams A4 paper', userAdmin]
    )).rows[0].id;

    await client.query(
      `INSERT INTO purchase_items (purchase_id, inventory_item_id, quantity, unit_cost, line_total)
       VALUES ($1,$2,$3,$4,$5)`,
      [purch1, invPaperA4, 100, 180.00, 18000.00]
    );

    // Corresponding inventory transaction
    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invPaperA4, 'purchase', 100, 'purchase', purch1, 180.00, userAdmin]
    );

    // Purchase 2 — A3 paper
    const purch2 = (await client.query(
      `INSERT INTO purchases (supplier_id, date, total_amount, invoice_number, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [supplierPaper, '2026-06-15', 9600.00, 'RPM-2026-0598', '30 reams A3 paper', userManager]
    )).rows[0].id;

    await client.query(
      `INSERT INTO purchase_items (purchase_id, inventory_item_id, quantity, unit_cost, line_total)
       VALUES ($1,$2,$3,$4,$5)`,
      [purch2, invPaperA3, 30, 320.00, 9600.00]
    );

    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invPaperA3, 'purchase', 30, 'purchase', purch2, 320.00, userManager]
    );

    // Purchase 3 — Ink cartridges
    const purch3 = (await client.query(
      `INSERT INTO purchases (supplier_id, date, total_amount, invoice_number, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [supplierInk, '2026-07-01', 12600.00, 'SIT-2026-189', '6 black + 3 color cartridges', userAdmin]
    )).rows[0].id;

    await client.query(
      `INSERT INTO purchase_items (purchase_id, inventory_item_id, quantity, unit_cost, line_total)
       VALUES ($1,$2,$3,$4,$5)`,
      [purch3, invInkBlack, 6, 1200.00, 7200.00]
    );
    await client.query(
      `INSERT INTO purchase_items (purchase_id, inventory_item_id, quantity, unit_cost, line_total)
       VALUES ($1,$2,$3,$4,$5)`,
      [purch3, invInkColor, 3, 1800.00, 5400.00]
    );

    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invInkBlack, 'purchase', 6, 'purchase', purch3, 1200.00, userAdmin]
    );
    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invInkColor, 'purchase', 3, 'purchase', purch3, 1800.00, userAdmin]
    );

    // Purchase 4 — Banner vinyl
    const purch4 = (await client.query(
      `INSERT INTO purchases (supplier_id, date, total_amount, invoice_number, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [supplierPackaging, '2026-07-10', 3000.00, 'NPC-2026-334', '200 sqft vinyl flex', userManager]
    )).rows[0].id;

    await client.query(
      `INSERT INTO purchase_items (purchase_id, inventory_item_id, quantity, unit_cost, line_total)
       VALUES ($1,$2,$3,$4,$5)`,
      [purch4, invBannerVinyl, 200, 15.00, 3000.00]
    );

    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invBannerVinyl, 'purchase', 200, 'purchase', purch4, 15.00, userManager]
    );

    // Purchase 5 — Lamination and binding supplies
    const purch5 = (await client.query(
      `INSERT INTO purchases (supplier_id, date, total_amount, invoice_number, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [supplierPackaging, '2026-08-01', 2140.00, 'NPC-2026-412', 'Lamination film + spiral rings', userAdmin]
    )).rows[0].id;

    await client.query(
      `INSERT INTO purchase_items (purchase_id, inventory_item_id, quantity, unit_cost, line_total)
       VALUES ($1,$2,$3,$4,$5)`,
      [purch5, invLamination, 100, 12.00, 1200.00]
    );
    await client.query(
      `INSERT INTO purchase_items (purchase_id, inventory_item_id, quantity, unit_cost, line_total)
       VALUES ($1,$2,$3,$4,$5)`,
      [purch5, invBinding, 100, 8.00, 800.00]
    );
    await client.query(
      `INSERT INTO purchase_items (purchase_id, inventory_item_id, quantity, unit_cost, line_total)
       VALUES ($1,$2,$3,$4,$5)`,
      [purch5, invEnvelope, 50, 2.80, 140.00]
    );

    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invLamination, 'purchase', 100, 'purchase', purch5, 12.00, userAdmin]
    );
    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invBinding, 'purchase', 100, 'purchase', purch5, 8.00, userAdmin]
    );
    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invEnvelope, 'purchase', 50, 'purchase', purch5, 2.80, userAdmin]
    );

    // ─── ORDER CONSUMPTION TRANSACTIONS ──────────────────────────
    console.log('  📉 Creating inventory consumption transactions...');

    // ORD-1001: 10 × Visiting Cards consumed card stock & ink
    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invCardStock, 'order_consumption', -100, 'order', ord1, 5.25, userEmployee]
    );
    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invInkColor, 'order_consumption', -0.5, 'order', ord1, 1750.00, userEmployee]
    );

    // ORD-1002: 200 sqft banners consumed vinyl & ink
    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invBannerVinyl, 'order_consumption', -200, 'order', ord4, 14.50, userEmployee]
    );
    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invInkColor, 'order_consumption', -4, 'order', ord4, 1750.00, userEmployee]
    );

    // ORD-1003: 200 wedding invitations consumed card stock, ink, envelopes
    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invCardStock, 'order_consumption', -400, 'order', ord6, 5.25, userEmployee]
    );
    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invInkColor, 'order_consumption', -3, 'order', ord6, 1750.00, userEmployee]
    );
    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invEnvelope, 'order_consumption', -200, 'order', ord6, 2.80, userEmployee]
    );

    // A couple of manual adjustments & damaged items
    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [invInkBlack, 'damaged', -1, 'manual', null, 1150.00, userManager, '2026-07-15']
    );
    await client.query(
      `INSERT INTO inventory_transactions (inventory_item_id, transaction_type, quantity_change, reference_type, reference_id, cost_at_time, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [invPaperA4, 'stock_correction', -5, 'manual', null, 175.00, userAdmin, '2026-08-01']
    );

    // ─── EXPENSES ────────────────────────────────────────────────
    console.log('  💸 Creating expenses...');

    await client.query(
      `INSERT INTO expenses (date, supplier_id, category, description, amount, payment_method, invoice_number, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      ['2026-06-05', supplierPaper, 'raw_materials', 'Card stock 300 GSM — 1000 sheets', 5500.00, 'bank_transfer', 'RPM-2026-0530', null, userAdmin]
    );

    await client.query(
      `INSERT INTO expenses (date, category, description, amount, payment_method, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['2026-06-20', 'electricity', 'June electricity bill — workshop', 4500.00, 'upi', 'JVVNL bill', userAdmin]
    );

    await client.query(
      `INSERT INTO expenses (date, category, description, amount, payment_method, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['2026-07-05', 'maintenance', 'Printer head cleaning & calibration', 2000.00, 'cash', 'Annual maintenance', userManager]
    );

    await client.query(
      `INSERT INTO expenses (date, category, description, amount, payment_method, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['2026-07-18', 'transport', 'Delivery charges — 5 orders batch delivery', 800.00, 'cash', null, userEmployee]
    );

    await client.query(
      `INSERT INTO expenses (date, supplier_id, category, description, amount, payment_method, invoice_number, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      ['2026-08-02', supplierPackaging, 'packaging', 'Corrugated boxes for bulk order shipping', 1200.00, 'upi', 'NPC-2026-415', null, userManager]
    );

    await client.query(
      `INSERT INTO expenses (date, category, description, amount, payment_method, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['2026-08-15', 'office', 'Office stationery and cleaning supplies', 650.00, 'cash', 'Monthly office expense', userAdmin]
    );

    // ─── COMMIT ──────────────────────────────────────────────────
    await client.query('COMMIT');
    console.log('\n✅ Seed completed successfully!');

    // Print summary
    const counts = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM clients'),
      pool.query('SELECT COUNT(*) FROM suppliers'),
      pool.query('SELECT COUNT(*) FROM inventory_items'),
      pool.query('SELECT COUNT(*) FROM products'),
      pool.query('SELECT COUNT(*) FROM orders'),
      pool.query('SELECT COUNT(*) FROM order_items'),
      pool.query('SELECT COUNT(*) FROM payments'),
      pool.query('SELECT COUNT(*) FROM purchases'),
      pool.query('SELECT COUNT(*) FROM expenses'),
      pool.query('SELECT COUNT(*) FROM inventory_transactions'),
    ]);

    console.log('\n📊 Seeded data summary:');
    console.log(`   Users:                  ${counts[0].rows[0].count}`);
    console.log(`   Clients:                ${counts[1].rows[0].count}`);
    console.log(`   Suppliers:              ${counts[2].rows[0].count}`);
    console.log(`   Inventory Items:        ${counts[3].rows[0].count}`);
    console.log(`   Products:               ${counts[4].rows[0].count}`);
    console.log(`   Orders:                 ${counts[5].rows[0].count}`);
    console.log(`   Order Items:            ${counts[6].rows[0].count}`);
    console.log(`   Payments:               ${counts[7].rows[0].count}`);
    console.log(`   Purchases:              ${counts[8].rows[0].count}`);
    console.log(`   Expenses:               ${counts[9].rows[0].count}`);
    console.log(`   Inventory Transactions: ${counts[10].rows[0].count}`);

    // Show low-stock items
    const lowStock = await pool.query(
      `SELECT name, current_quantity, minimum_stock_level, unit
       FROM inventory_items WHERE current_quantity <= minimum_stock_level`
    );
    if (lowStock.rows.length > 0) {
      console.log(`\n⚠️  Low stock items (${lowStock.rows.length}):`);
      for (const item of lowStock.rows) {
        console.log(`   - ${item.name}: ${item.current_quantity} ${item.unit} (min: ${item.minimum_stock_level})`);
      }
    }

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Seed failed:', err);
    process.exit(1);
  });
