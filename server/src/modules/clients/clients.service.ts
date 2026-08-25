import pool from '../../db/pool.js';
import { NotFoundError, AppError } from '../../utils/errors.js';
import {
  CreateClientInput,
  UpdateClientInput,
  ClientQueryParams,
  ContactInput,
} from './clients.validation.js';

export async function listClients(params: ClientQueryParams) {
  const { page, limit, search, client_type } = params;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(
      `(c.name ILIKE $${paramIdx} OR c.mobile ILIKE $${paramIdx} OR c.email ILIKE $${paramIdx} OR c.contact_person ILIKE $${paramIdx})`
    );
    values.push(`%${search}%`);
    paramIdx++;
  }

  if (client_type) {
    conditions.push(`c.client_type = $${paramIdx}`);
    values.push(client_type);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM clients c ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get clients with contact count and total orders count
  const query = `
    SELECT 
      c.*,
      COUNT(DISTINCT cc.id)::int AS contacts_count,
      COUNT(DISTINCT o.id)::int AS total_orders,
      COALESCE(SUM(o.total_amount), 0)::numeric(12,2) AS total_spent
    FROM clients c
    LEFT JOIN client_contacts cc ON cc.client_id = c.id
    LEFT JOIN orders o ON o.client_id = c.id
    ${whereClause}
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  values.push(limit, offset);
  const result = await pool.query(query, values);

  return {
    clients: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function searchClients(q: string) {
  const isNumeric = /^\d+$/.test(q.trim());
  let query: string;
  let values: any[];

  if (isNumeric) {
    query = `
      SELECT c.id, c.name, c.contact_person, c.mobile, c.email, c.client_type, c.address
      FROM clients c
      WHERE c.id = $1 OR c.mobile ILIKE $2
      ORDER BY c.name ASC
      LIMIT 20
    `;
    values = [parseInt(q.trim(), 10), `%${q.trim()}%`];
  } else {
    query = `
      SELECT c.id, c.name, c.contact_person, c.mobile, c.email, c.client_type, c.address
      FROM clients c
      WHERE c.name ILIKE $1 OR c.email ILIKE $1 OR c.contact_person ILIKE $1
      ORDER BY c.name ASC
      LIMIT 20
    `;
    values = [`%${q.trim()}%`];
  }

  const result = await pool.query(query, values);
  return result.rows;
}

export async function checkForDuplicates(mobile?: string | null, email?: string | null) {
  const duplicates: any[] = [];
  const checks: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (mobile && mobile.trim()) {
    checks.push(`mobile = $${paramIdx}`);
    values.push(mobile.trim());
    paramIdx++;
  }

  if (email && email.trim()) {
    checks.push(`LOWER(email) = $${paramIdx}`);
    values.push(email.trim().toLowerCase());
    paramIdx++;
  }

  if (checks.length > 0) {
    const query = `
      SELECT id, name, contact_person, mobile, email, client_type 
      FROM clients 
      WHERE ${checks.join(' OR ')}
    `;
    const res = await pool.query(query, values);
    duplicates.push(...res.rows);
  }

  return duplicates;
}

export async function createClient(input: CreateClientInput) {
  const duplicates = await checkForDuplicates(input.mobile, input.email);

  if (duplicates.length > 0 && !input.allow_duplicate) {
    return {
      created: false,
      warning: 'Potential duplicate client detected with matching mobile or email.',
      duplicates,
      client: null,
    };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const emailValue = input.email && input.email.trim() ? input.email.trim().toLowerCase() : null;
    const mobileValue = input.mobile && input.mobile.trim() ? input.mobile.trim() : null;

    const clientRes = await client.query(
      `INSERT INTO clients (name, contact_person, mobile, email, address, gst_number, client_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.name.trim(),
        input.contact_person || null,
        mobileValue,
        emailValue,
        input.address || null,
        input.gst_number || null,
        input.client_type,
        input.notes || null,
      ]
    );

    const newClient = clientRes.rows[0];

    // Insert contacts if provided
    const contacts: any[] = [];
    if (input.contacts && input.contacts.length > 0) {
      for (const contact of input.contacts) {
        const contactEmail = contact.email && contact.email.trim() ? contact.email.trim().toLowerCase() : null;
        const contactRes = await client.query(
          `INSERT INTO client_contacts (client_id, name, designation, mobile, email, is_primary, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            newClient.id,
            contact.name.trim(),
            contact.designation || null,
            contact.mobile || null,
            contactEmail,
            contact.is_primary,
            contact.notes || null,
          ]
        );
        contacts.push(contactRes.rows[0]);
      }
    }

    await client.query('COMMIT');
    return {
      created: true,
      warning: duplicates.length > 0 ? 'Client created with confirmed duplicate mobile/email' : undefined,
      duplicates: duplicates.length > 0 ? duplicates : undefined,
      client: { ...newClient, contacts },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getClientById(id: number) {
  const clientRes = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);
  if (clientRes.rows.length === 0) {
    throw new NotFoundError(`Client with ID ${id} not found`);
  }

  const contactsRes = await pool.query(
    'SELECT * FROM client_contacts WHERE client_id = $1 ORDER BY is_primary DESC, id ASC',
    [id]
  );

  return {
    ...clientRes.rows[0],
    contacts: contactsRes.rows,
  };
}

export async function updateClient(id: number, input: UpdateClientInput) {
  await getClientById(id); // Ensure exists

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
  if (input.client_type !== undefined) {
    fields.push(`client_type = $${paramIdx++}`);
    values.push(input.client_type);
  }
  if (input.notes !== undefined) {
    fields.push(`notes = $${paramIdx++}`);
    values.push(input.notes || null);
  }

  if (fields.length === 0) {
    return getClientById(id);
  }

  values.push(id);
  const query = `
    UPDATE clients 
    SET ${fields.join(', ')} 
    WHERE id = $${paramIdx} 
    RETURNING *
  `;

  const result = await pool.query(query, values);
  const contacts = await pool.query(
    'SELECT * FROM client_contacts WHERE client_id = $1 ORDER BY is_primary DESC, id ASC',
    [id]
  );

  return {
    ...result.rows[0],
    contacts: contacts.rows,
  };
}

export async function deleteClient(id: number) {
  await getClientById(id); // Ensure exists

  // Check if client has orders
  const ordersCheck = await pool.query('SELECT COUNT(*) FROM orders WHERE client_id = $1', [id]);
  if (parseInt(ordersCheck.rows[0].count, 10) > 0) {
    throw new AppError(
      `Cannot delete client. This client has ${ordersCheck.rows[0].count} historical order(s). Financial records are protected by database policy.`,
      400,
      'CLIENT_HAS_ORDERS'
    );
  }

  await pool.query('DELETE FROM clients WHERE id = $1', [id]);
  return { deleted: true, id };
}

export async function getClientProfile(id: number) {
  const client = await getClientById(id);

  // 1. Order & Billing Aggregates
  const aggregatesRes = await pool.query(
    `
    SELECT 
      COUNT(DISTINCT o.id)::int AS total_orders,
      COALESCE(SUM(oi.quantity), 0)::numeric(12,2) AS total_quantity_ordered,
      COALESCE(SUM(o.total_amount), 0)::numeric(12,2) AS total_amount_billed,
      MAX(o.order_date) AS last_order_date
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.client_id = $1
    `,
    [id]
  );

  // 2. Payments Aggregate
  const paymentsRes = await pool.query(
    `
    SELECT COALESCE(SUM(p.amount), 0)::numeric(12,2) AS total_amount_paid
    FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE o.client_id = $1
    `,
    [id]
  );

  const totalBilled = parseFloat(aggregatesRes.rows[0].total_amount_billed) || 0;
  const totalPaid = parseFloat(paymentsRes.rows[0].total_amount_paid) || 0;
  const outstandingAmount = Math.max(0, totalBilled - totalPaid);

  // 3. Top Products Ordered
  const topProductsRes = await pool.query(
    `
    SELECT 
      p.id AS product_id,
      p.name AS product_name,
      p.category,
      p.unit,
      COUNT(DISTINCT o.id)::int AS times_ordered,
      SUM(oi.quantity)::numeric(12,2) AS total_quantity,
      SUM(oi.line_total)::numeric(12,2) AS total_spent
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE o.client_id = $1
    GROUP BY p.id, p.name, p.category, p.unit
    ORDER BY total_quantity DESC
    LIMIT 5
    `,
    [id]
  );

  // 4. Order History
  const ordersHistoryRes = await pool.query(
    `
    SELECT 
      o.id,
      o.order_number,
      o.order_date,
      o.expected_delivery_date,
      o.total_amount,
      o.payment_status,
      o.production_status,
      COUNT(oi.id)::int AS items_count
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.client_id = $1
    GROUP BY o.id
    ORDER BY o.order_date DESC, o.id DESC
    `,
    [id]
  );

  // 5. Payment History
  const paymentsHistoryRes = await pool.query(
    `
    SELECT 
      p.id,
      p.order_id,
      o.order_number,
      p.amount,
      p.payment_method,
      p.payment_date,
      p.notes,
      p.created_at
    FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE o.client_id = $1
    ORDER BY p.payment_date DESC, p.id DESC
    `,
    [id]
  );

  return {
    client,
    metrics: {
      total_orders: aggregatesRes.rows[0].total_orders || 0,
      total_quantity_ordered: aggregatesRes.rows[0].total_quantity_ordered || 0,
      total_amount_billed: totalBilled,
      total_amount_paid: totalPaid,
      outstanding_amount: outstandingAmount,
      last_order_date: aggregatesRes.rows[0].last_order_date || null,
    },
    top_products: topProductsRes.rows,
    orders_history: ordersHistoryRes.rows,
    payments_history: paymentsHistoryRes.rows,
  };
}

// Client Contacts CRUD
export async function addContact(clientId: number, input: ContactInput) {
  await getClientById(clientId);
  const emailVal = input.email && input.email.trim() ? input.email.trim().toLowerCase() : null;

  const result = await pool.query(
    `INSERT INTO client_contacts (client_id, name, designation, mobile, email, is_primary, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      clientId,
      input.name.trim(),
      input.designation || null,
      input.mobile || null,
      emailVal,
      input.is_primary,
      input.notes || null,
    ]
  );

  return result.rows[0];
}

export async function updateContact(clientId: number, contactId: number, input: Partial<ContactInput>) {
  await getClientById(clientId);

  const check = await pool.query(
    'SELECT * FROM client_contacts WHERE id = $1 AND client_id = $2',
    [contactId, clientId]
  );
  if (check.rows.length === 0) {
    throw new NotFoundError(`Contact ${contactId} not found for client ${clientId}`);
  }

  const fields: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (input.name !== undefined) {
    fields.push(`name = $${paramIdx++}`);
    values.push(input.name.trim());
  }
  if (input.designation !== undefined) {
    fields.push(`designation = $${paramIdx++}`);
    values.push(input.designation || null);
  }
  if (input.mobile !== undefined) {
    fields.push(`mobile = $${paramIdx++}`);
    values.push(input.mobile || null);
  }
  if (input.email !== undefined) {
    fields.push(`email = $${paramIdx++}`);
    values.push(input.email ? input.email.toLowerCase().trim() : null);
  }
  if (input.is_primary !== undefined) {
    fields.push(`is_primary = $${paramIdx++}`);
    values.push(input.is_primary);
  }
  if (input.notes !== undefined) {
    fields.push(`notes = $${paramIdx++}`);
    values.push(input.notes || null);
  }

  values.push(contactId, clientId);
  const query = `
    UPDATE client_contacts 
    SET ${fields.join(', ')} 
    WHERE id = $${paramIdx} AND client_id = $${paramIdx + 1}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
}

export async function deleteContact(clientId: number, contactId: number) {
  const result = await pool.query(
    'DELETE FROM client_contacts WHERE id = $1 AND client_id = $2 RETURNING id',
    [contactId, clientId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError(`Contact ${contactId} not found for client ${clientId}`);
  }

  return { deleted: true, id: contactId };
}
