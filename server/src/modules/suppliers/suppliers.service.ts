import pool from '../../db/pool.js';
import { NotFoundError, AppError } from '../../utils/errors.js';
import {
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierQueryParams,
} from './suppliers.validation.js';

export async function listSuppliers(params: SupplierQueryParams) {
  const { page, limit, search } = params;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(
      `(s.name ILIKE $${paramIdx} OR s.contact_person ILIKE $${paramIdx} OR s.mobile ILIKE $${paramIdx} OR s.email ILIKE $${paramIdx})`
    );
    values.push(`%${search}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM suppliers s ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const query = `
    SELECT 
      s.*,
      COUNT(DISTINCT ii.id)::int AS items_supplied_count,
      COUNT(DISTINCT p.id)::int AS purchases_count,
      COALESCE(SUM(p.total_amount), 0)::numeric(12,2) AS total_purchased_amount
    FROM suppliers s
    LEFT JOIN inventory_items ii ON ii.supplier_id = s.id
    LEFT JOIN purchases p ON p.supplier_id = s.id
    ${whereClause}
    GROUP BY s.id
    ORDER BY s.name ASC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  values.push(limit, offset);
  const result = await pool.query(query, values);

  return {
    suppliers: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getSupplierById(id: number) {
  const supplierRes = await pool.query('SELECT * FROM suppliers WHERE id = $1', [id]);
  if (supplierRes.rows.length === 0) {
    throw new NotFoundError(`Supplier with ID ${id} not found`);
  }

  const itemsRes = await pool.query(
    'SELECT id, name, category, unit, current_quantity, minimum_stock_level, purchase_price, average_cost FROM inventory_items WHERE supplier_id = $1 ORDER BY name ASC',
    [id]
  );

  const purchasesRes = await pool.query(
    'SELECT id, date, total_amount, invoice_number, created_at FROM purchases WHERE supplier_id = $1 ORDER BY date DESC LIMIT 10',
    [id]
  );

  return {
    ...supplierRes.rows[0],
    supplied_items: itemsRes.rows,
    recent_purchases: purchasesRes.rows,
  };
}

export async function createSupplier(input: CreateSupplierInput) {
  const emailVal = input.email && input.email.trim() ? input.email.trim().toLowerCase() : null;
  const mobileVal = input.mobile && input.mobile.trim() ? input.mobile.trim() : null;

  const result = await pool.query(
    `INSERT INTO suppliers (name, contact_person, mobile, email, address, gst_number, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.name.trim(),
      input.contact_person || null,
      mobileVal,
      emailVal,
      input.address || null,
      input.gst_number || null,
      input.notes || null,
    ]
  );

  return result.rows[0];
}

export async function updateSupplier(id: number, input: UpdateSupplierInput) {
  await getSupplierById(id);

  const fields: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (input.name !== undefined) {
    fields.push(`name = $${paramIdx++}`);
    values.push(input.name.trim());
  }
  if (input.contact_person !== undefined) {
    fields.push(`contact_person = $${paramIdx++}`);
    values.push(input.contact_person || null);
  }
  if (input.mobile !== undefined) {
    fields.push(`mobile = $${paramIdx++}`);
    values.push(input.mobile || null);
  }
  if (input.email !== undefined) {
    fields.push(`email = $${paramIdx++}`);
    values.push(input.email ? input.email.toLowerCase().trim() : null);
  }
  if (input.address !== undefined) {
    fields.push(`address = $${paramIdx++}`);
    values.push(input.address || null);
  }
  if (input.gst_number !== undefined) {
    fields.push(`gst_number = $${paramIdx++}`);
    values.push(input.gst_number || null);
  }
  if (input.notes !== undefined) {
    fields.push(`notes = $${paramIdx++}`);
    values.push(input.notes || null);
  }

  if (fields.length > 0) {
    values.push(id);
    const query = `
      UPDATE suppliers 
      SET ${fields.join(', ')} 
      WHERE id = $${paramIdx} 
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  return getSupplierById(id);
}

export async function deleteSupplier(id: number) {
  await getSupplierById(id);

  // Check if supplier has items
  const itemsCheck = await pool.query(
    'SELECT COUNT(*) FROM inventory_items WHERE supplier_id = $1',
    [id]
  );
  if (parseInt(itemsCheck.rows[0].count, 10) > 0) {
    throw new AppError(
      `Cannot delete supplier. ${itemsCheck.rows[0].count} inventory item(s) are linked to this supplier.`,
      400,
      'SUPPLIER_HAS_ITEMS'
    );
  }

  // Check if supplier has purchases
  const purchasesCheck = await pool.query(
    'SELECT COUNT(*) FROM purchases WHERE supplier_id = $1',
    [id]
  );
  if (parseInt(purchasesCheck.rows[0].count, 10) > 0) {
    throw new AppError(
      `Cannot delete supplier with historical purchase records.`,
      400,
      'SUPPLIER_HAS_PURCHASES'
    );
  }

  await pool.query('DELETE FROM suppliers WHERE id = $1', [id]);
  return { deleted: true, id };
}
