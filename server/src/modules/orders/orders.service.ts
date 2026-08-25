import pool from '../../db/pool.js';
import { NotFoundError, AppError } from '../../utils/errors.js';
import {
  CreateOrderInput,
  UpdateOrderInput,
  OrderQueryParams,
  UpdateStatusInput,
} from './orders.validation.js';
import { PoolClient } from 'pg';

// State machine allowed transitions
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  received: ['design', 'production', 'cancelled'],
  design: ['production', 'received', 'cancelled'],
  production: ['quality_check', 'ready', 'delivered', 'cancelled'],
  quality_check: ['ready', 'production', 'delivered', 'cancelled'],
  ready: ['delivered', 'quality_check', 'cancelled'],
  delivered: [], // Terminal state
  cancelled: [], // Terminal state
};

// Generate next human-readable unique order number (e.g. ORD-1016)
async function generateOrderNumber(client: PoolClient): Promise<string> {
  const countRes = await client.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM orders');
  const nextId = parseInt(countRes.rows[0].next_id, 10);
  const candidateNumber = `ORD-${1000 + nextId}`;

  // Ensure absolute uniqueness
  const exists = await client.query('SELECT id FROM orders WHERE order_number = $1', [candidateNumber]);
  if (exists.rows.length === 0) {
    return candidateNumber;
  }

  // Fallback if custom order numbers were inserted
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${1000 + nextId}-${randomSuffix}`;
}

export async function listOrders(params: OrderQueryParams) {
  const { page, limit, production_status, payment_status, status, client_id, start_date, end_date, search } = params;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (production_status) {
    conditions.push(`o.production_status = $${paramIdx++}`);
    values.push(production_status);
  } else if (status) {
    // Handle alias statuses
    if (status === 'pending') {
      conditions.push(`o.production_status IN ('received', 'design')`);
    } else if (status === 'completed' || status === 'delivered') {
      conditions.push(`o.production_status = 'delivered'`);
    } else if (status === 'payment_pending') {
      conditions.push(`o.payment_status IN ('unpaid', 'partially_paid')`);
    } else {
      conditions.push(`o.production_status = $${paramIdx++}`);
      values.push(status);
    }
  }

  if (payment_status) {
    conditions.push(`o.payment_status = $${paramIdx++}`);
    values.push(payment_status);
  }

  if (client_id) {
    conditions.push(`o.client_id = $${paramIdx++}`);
    values.push(client_id);
  }

  if (start_date) {
    conditions.push(`o.order_date >= $${paramIdx++}`);
    values.push(start_date);
  }

  if (end_date) {
    conditions.push(`o.order_date <= $${paramIdx++}`);
    values.push(end_date);
  }

  if (search) {
    conditions.push(`(
      o.order_number ILIKE $${paramIdx} OR
      c.name ILIKE $${paramIdx} OR
      c.mobile ILIKE $${paramIdx} OR
      EXISTS (
        SELECT 1 FROM order_items oi 
        JOIN products p ON p.id = oi.product_id 
        WHERE oi.order_id = o.id AND p.name ILIKE $${paramIdx}
      )
    )`);
    values.push(`%${search}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(DISTINCT o.id) 
     FROM orders o 
     JOIN clients c ON c.id = o.client_id 
     ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const query = `
    SELECT 
      o.*,
      c.name AS client_name,
      c.mobile AS client_mobile,
      c.email AS client_email,
      c.client_type,
      COUNT(oi.id)::int AS items_count,
      COALESCE(SUM(oi.quantity), 0)::numeric(12,2) AS total_quantity,
      COALESCE((
        SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id
      ), 0)::numeric(12,2) AS amount_paid,
      (o.total_amount - COALESCE((
        SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id
      ), 0))::numeric(12,2) AS balance_due,
      u.name AS created_by_name
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN users u ON u.id = o.created_by
    ${whereClause}
    GROUP BY o.id, c.name, c.mobile, c.email, c.client_type, u.name
    ORDER BY o.order_date DESC, o.id DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  values.push(limit, offset);
  const result = await pool.query(query, values);

  return {
    orders: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getOrderById(id: number) {
  const orderRes = await pool.query(
    `
    SELECT 
      o.*,
      c.name AS client_name,
      c.contact_person AS client_contact_person,
      c.mobile AS client_mobile,
      c.email AS client_email,
      c.address AS client_address,
      c.gst_number AS client_gst,
      c.client_type,
      u.name AS created_by_name,
      u.email AS created_by_email,
      COALESCE((
        SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id
      ), 0)::numeric(12,2) AS amount_paid,
      (o.total_amount - COALESCE((
        SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id
      ), 0))::numeric(12,2) AS balance_due
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    LEFT JOIN users u ON u.id = o.created_by
    WHERE o.id = $1
    `,
    [id]
  );

  if (orderRes.rows.length === 0) {
    throw new NotFoundError(`Order with ID ${id} not found`);
  }

  const itemsRes = await pool.query(
    `
    SELECT 
      oi.*,
      p.name AS product_name,
      p.category AS product_category,
      p.unit AS product_unit,
      p.default_selling_price AS current_default_price
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = $1
    ORDER BY oi.id ASC
    `,
    [id]
  );

  const historyRes = await pool.query(
    `
    SELECT 
      osh.*,
      u.name AS changed_by_name,
      u.role AS changed_by_role
    FROM order_status_history osh
    LEFT JOIN users u ON u.id = osh.changed_by
    WHERE osh.order_id = $1
    ORDER BY osh.changed_at ASC, osh.id ASC
    `,
    [id]
  );

  const paymentsRes = await pool.query(
    `
    SELECT 
      p.*,
      u.name AS created_by_name
    FROM payments p
    LEFT JOIN users u ON u.id = p.created_by
    WHERE p.order_id = $1
    ORDER BY p.payment_date DESC, p.id DESC
    `,
    [id]
  );

  const inventoryTxRes = await pool.query(
    `
    SELECT 
      it.*,
      ii.name AS item_name,
      ii.unit AS item_unit,
      u.name AS created_by_name
    FROM inventory_transactions it
    JOIN inventory_items ii ON ii.id = it.inventory_item_id
    LEFT JOIN users u ON u.id = it.created_by
    WHERE it.reference_type IN ('order', 'order_cancellation_restore') AND it.reference_id = $1
    ORDER BY it.created_at ASC
    `,
    [id]
  );

  const hasConsumedInventory = inventoryTxRes.rows.some(
    (tx) => tx.transaction_type === 'order_consumption'
  );
  const hasRestoredInventory = inventoryTxRes.rows.some(
    (tx) => tx.reference_type === 'order_cancellation_restore'
  );

  return {
    ...orderRes.rows[0],
    has_consumed_inventory: hasConsumedInventory,
    has_restored_inventory: hasRestoredInventory,
    can_restore_inventory: orderRes.rows[0].production_status === 'cancelled' && hasConsumedInventory && !hasRestoredInventory,
    items: itemsRes.rows,
    status_history: historyRes.rows,
    payments: paymentsRes.rows,
    inventory_transactions: inventoryTxRes.rows,
  };
}

/**
 * Creates an order with line items in a single transaction.
 * Calculates all totals server-side.
 * Does NOT touch inventory at this stage.
 */
export async function createOrder(input: CreateOrderInput, userId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify client exists
    const clientCheck = await client.query('SELECT id FROM clients WHERE id = $1', [input.client_id]);
    if (clientCheck.rows.length === 0) {
      throw new NotFoundError(`Client with ID ${input.client_id} not found`);
    }

    // 2. Fetch and validate all products, freeze unit prices and calculate line totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    const validatedItems: {
      product_id: number;
      quantity: number;
      unit_price: number;
      discount: number;
      tax: number;
      line_total: number;
    }[] = [];

    for (const item of input.items) {
      const prodRes = await client.query('SELECT id, name, default_selling_price, active FROM products WHERE id = $1', [
        item.product_id,
      ]);

      if (prodRes.rows.length === 0) {
        throw new NotFoundError(`Product with ID ${item.product_id} not found`);
      }

      const prod = prodRes.rows[0];
      const unitPrice = item.unit_price !== undefined ? item.unit_price : parseFloat(prod.default_selling_price);
      const discount = item.discount || 0;
      const tax = item.tax || 0;
      const qty = item.quantity;
      const lineTotal = parseFloat(((qty * unitPrice) - discount + tax).toFixed(2));

      subtotal += qty * unitPrice;
      totalDiscount += discount;
      totalTax += tax;

      validatedItems.push({
        product_id: item.product_id,
        quantity: qty,
        unit_price: unitPrice,
        discount,
        tax,
        line_total: lineTotal,
      });
    }

    const totalAmount = parseFloat((subtotal - totalDiscount + totalTax).toFixed(2));
    const orderNumber = await generateOrderNumber(client);
    const orderDate = input.order_date || new Date().toISOString().split('T')[0];

    // 3. Insert order header
    const orderRes = await client.query(
      `INSERT INTO orders (
        order_number, client_id, order_date, expected_delivery_date,
        subtotal, discount, tax, total_amount, payment_status,
        production_status, notes, internal_notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unpaid', 'received', $9, $10, $11)
      RETURNING *`,
      [
        orderNumber,
        input.client_id,
        orderDate,
        input.expected_delivery_date || null,
        subtotal,
        totalDiscount,
        totalTax,
        totalAmount,
        input.notes || null,
        input.internal_notes || null,
        userId,
      ]
    );

    const newOrder = orderRes.rows[0];

    // 4. Insert order items (historical price frozen)
    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO order_items (
          order_id, product_id, quantity, unit_price, discount, tax, line_total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newOrder.id,
          item.product_id,
          item.quantity,
          item.unit_price,
          item.discount,
          item.tax,
          item.line_total,
        ]
      );
    }

    // 5. Initial status history
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, notes)
       VALUES ($1, 'received', $2, 'Order created and received')`,
      [newOrder.id, userId]
    );

    await client.query('COMMIT');
    return getOrderById(newOrder.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Edit order details with guardrails:
 * - Pre-production (received/design): Line items and client can be modified.
 * - Post-production (production/quality_check/ready/delivered): Line items locked; only notes and expected delivery date can be updated.
 * - Cancelled: Locked.
 */
export async function updateOrder(id: number, input: UpdateOrderInput, userId: number) {
  const currentOrder = await getOrderById(id);

  if (currentOrder.production_status === 'cancelled') {
    throw new AppError('Cancelled orders cannot be edited.', 400, 'ORDER_CANCELLED');
  }

  const isPostProduction = ['production', 'quality_check', 'ready', 'delivered'].includes(
    currentOrder.production_status
  );

  if (isPostProduction && (input.items || input.client_id)) {
    throw new AppError(
      'Cannot modify line items or client after production has begun and raw materials have been consumed. Only delivery dates and notes can be edited.',
      400,
      'ORDER_LOCKED_POST_PRODUCTION'
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!isPostProduction && input.items && input.items.length > 0) {
      // Recalculate line items
      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;

      const validatedItems: any[] = [];
      for (const item of input.items) {
        const prodRes = await client.query('SELECT id, default_selling_price FROM products WHERE id = $1', [
          item.product_id,
        ]);
        if (prodRes.rows.length === 0) {
          throw new NotFoundError(`Product ${item.product_id} not found`);
        }
        const unitPrice = item.unit_price !== undefined ? item.unit_price : parseFloat(prodRes.rows[0].default_selling_price);
        const discount = item.discount || 0;
        const tax = item.tax || 0;
        const lineTotal = parseFloat(((item.quantity * unitPrice) - discount + tax).toFixed(2));

        subtotal += item.quantity * unitPrice;
        totalDiscount += discount;
        totalTax += tax;

        validatedItems.push({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: unitPrice,
          discount,
          tax,
          line_total: lineTotal,
        });
      }

      const totalAmount = parseFloat((subtotal - totalDiscount + totalTax).toFixed(2));

      // Remove existing items and insert new
      await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
      for (const item of validatedItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount, tax, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, item.product_id, item.quantity, item.unit_price, item.discount, item.tax, item.line_total]
        );
      }

      await client.query(
        `UPDATE orders 
         SET subtotal = $1, discount = $2, tax = $3, total_amount = $4,
             client_id = COALESCE($5, client_id),
             expected_delivery_date = COALESCE($6, expected_delivery_date),
             notes = COALESCE($7, notes),
             internal_notes = COALESCE($8, internal_notes)
         WHERE id = $9`,
        [
          subtotal,
          totalDiscount,
          totalTax,
          totalAmount,
          input.client_id || null,
          input.expected_delivery_date || null,
          input.notes || null,
          input.internal_notes || null,
          id,
        ]
      );
    } else {
      // Non-item updates
      const fields: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      if (input.client_id !== undefined && !isPostProduction) {
        fields.push(`client_id = $${paramIdx++}`);
        values.push(input.client_id);
      }
      if (input.expected_delivery_date !== undefined) {
        fields.push(`expected_delivery_date = $${paramIdx++}`);
        values.push(input.expected_delivery_date);
      }
      if (input.notes !== undefined) {
        fields.push(`notes = $${paramIdx++}`);
        values.push(input.notes);
      }
      if (input.internal_notes !== undefined) {
        fields.push(`internal_notes = $${paramIdx++}`);
        values.push(input.internal_notes);
      }

      if (fields.length > 0) {
        values.push(id);
        await client.query(
          `UPDATE orders SET ${fields.join(', ')} WHERE id = $${paramIdx}`,
          values
        );
      }
    }

    await client.query('COMMIT');
    return getOrderById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Repeat Order Feature:
 * Duplicates an existing order into a new draft order copying client, line items, and prices.
 * Generates a new order number, new order date, sets status = 'received', payment_status = 'unpaid'.
 * Original order is 100% untouched.
 */
export async function duplicateOrder(sourceOrderId: number, userId: number) {
  const sourceOrder = await getOrderById(sourceOrderId);

  const duplicateInput: CreateOrderInput = {
    client_id: sourceOrder.client_id,
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: null,
    items: sourceOrder.items.map((item: any) => ({
      product_id: item.product_id,
      quantity: parseFloat(item.quantity),
      unit_price: parseFloat(item.unit_price),
      discount: parseFloat(item.discount),
      tax: parseFloat(item.tax),
    })),
    notes: `Repeat order duplicated from ${sourceOrder.order_number}`,
    internal_notes: sourceOrder.internal_notes,
  };

  return createOrder(duplicateInput, userId);
}

/**
 * Calculates raw material requirements across all line items of the order.
 * Compares against current inventory stock levels.
 */
export async function getOrderMaterialRequirements(orderId: number) {
  const order = await getOrderById(orderId);

  const query = `
    SELECT 
      ii.id AS inventory_item_id,
      ii.name AS material_name,
      ii.category AS material_category,
      ii.unit AS material_unit,
      ii.current_quantity AS current_stock,
      ii.minimum_stock_level,
      ii.average_cost,
      SUM(oi.quantity * pm.quantity_required_per_unit)::numeric(12,4) AS total_required_quantity
    FROM order_items oi
    JOIN product_materials pm ON pm.product_id = oi.product_id
    JOIN inventory_items ii ON ii.id = pm.inventory_item_id
    WHERE oi.order_id = $1
    GROUP BY ii.id, ii.name, ii.category, ii.unit, ii.current_quantity, ii.minimum_stock_level, ii.average_cost
    ORDER BY ii.name ASC
  `;

  const result = await pool.query(query, [orderId]);
  let hasShortage = false;

  const materials = result.rows.map((row) => {
    const required = parseFloat(row.total_required_quantity);
    const stock = parseFloat(row.current_stock);
    const isSufficient = stock >= required;
    const shortage = Math.max(0, parseFloat((required - stock).toFixed(4)));

    if (!isSufficient) {
      hasShortage = true;
    }

    return {
      inventory_item_id: row.inventory_item_id,
      material_name: row.material_name,
      material_category: row.material_category,
      unit: row.material_unit,
      required_quantity: required,
      current_stock: stock,
      shortage_amount: shortage,
      is_sufficient: isSufficient,
      unit_cost: parseFloat(row.average_cost),
      estimated_cost: parseFloat((required * parseFloat(row.average_cost)).toFixed(2)),
    };
  });

  const totalRawMaterialCost = materials.reduce((sum, m) => sum + m.estimated_cost, 0);

  return {
    order_id: order.id,
    order_number: order.order_number,
    can_fulfill_from_stock: !hasShortage,
    total_raw_material_cost: parseFloat(totalRawMaterialCost.toFixed(2)),
    materials_breakdown: materials,
  };
}

/**
 * Status Transition Workflow:
 * Handles state machine progression.
 * When entering 'production':
 *  - Calculates material needs
 *  - If insufficient stock and !force: throws 409 Conflict
 *  - If confirmed: deducts stock & logs inventory_transactions (order_consumption)
 */
export async function updateOrderStatus(
  orderId: number,
  input: UpdateStatusInput,
  userId: number
) {
  const currentOrder = await getOrderById(orderId);
  const currentStatus = currentOrder.production_status;
  const targetStatus = input.status;

  if (currentStatus === targetStatus) {
    return currentOrder;
  }

  // 1. Validate state machine transition
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new AppError(
      `Invalid status transition from "${currentStatus}" to "${targetStatus}". Allowed target statuses: ${allowed.join(', ') || 'None (terminal state)'}`,
      400,
      'INVALID_STATUS_TRANSITION'
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 2. Consumption Trigger: If moving into 'production' and materials haven't been consumed yet
    if (targetStatus === 'production') {
      const consumptionCheck = await client.query(
        `SELECT COUNT(*) FROM inventory_transactions 
         WHERE reference_type = 'order' AND reference_id = $1 AND transaction_type = 'order_consumption'`,
        [orderId]
      );
      const alreadyConsumed = parseInt(consumptionCheck.rows[0].count, 10) > 0;

      if (!alreadyConsumed) {
        // Calculate material requirements
        const reqs = await getOrderMaterialRequirements(orderId);

        if (!reqs.can_fulfill_from_stock && !input.force) {
          const shortfalls = reqs.materials_breakdown.filter((m) => !m.is_sufficient);
          throw new AppError(
            `Insufficient raw material stock to enter production. Shortfalls detected for: ${shortfalls.map((s) => `${s.material_name} (need ${s.required_quantity} ${s.unit}, have ${s.current_stock})`).join(', ')}. Pass force: true with a valid reason to proceed with negative stock.`,
            409,
            'INSUFFICIENT_STOCK_FOR_PRODUCTION',
            {
              order_id: orderId,
              order_number: currentOrder.order_number,
              can_fulfill_from_stock: false,
              shortfalls,
            }
          );
        }

        // Deduct inventory and create transaction records
        for (const mat of reqs.materials_breakdown) {
          // Lock row
          const itemRes = await client.query(
            'SELECT current_quantity, average_cost FROM inventory_items WHERE id = $1 FOR UPDATE',
            [mat.inventory_item_id]
          );

          if (itemRes.rows.length > 0) {
            const currentQty = parseFloat(itemRes.rows[0].current_quantity);
            const costAtTime = parseFloat(itemRes.rows[0].average_cost);
            const newQty = parseFloat((currentQty - mat.required_quantity).toFixed(2));

            // Update item quantity
            await client.query(
              'UPDATE inventory_items SET current_quantity = $1 WHERE id = $2',
              [newQty, mat.inventory_item_id]
            );

            // Log order_consumption transaction
            await client.query(
              `INSERT INTO inventory_transactions (
                inventory_item_id, transaction_type, quantity_change,
                reference_type, reference_id, cost_at_time, created_by
              ) VALUES ($1, 'order_consumption', $2, 'order', $3, $4, $5)`,
              [
                mat.inventory_item_id,
                -mat.required_quantity,
                orderId,
                costAtTime,
                userId,
              ]
            );
          }
        }
      }
    }

    // 3. Update order production_status
    await client.query(
      'UPDATE orders SET production_status = $1 WHERE id = $2',
      [targetStatus, orderId]
    );

    // 4. Record status change history
    const historyNote = input.notes || (input.force ? `Production forced with negative stock override: ${input.reason}` : `Status changed to ${targetStatus}`);
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, notes)
       VALUES ($1, $2, $3, $4)`,
      [orderId, targetStatus, userId, historyNote]
    );

    await client.query('COMMIT');
    return getOrderById(orderId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Cancels an order.
 * If order was in pre-production, cancels with zero inventory impact.
 * If order had consumed inventory, marks cancelled and enables inventory restoration.
 */
export async function cancelOrder(orderId: number, notes: string | null, userId: number) {
  const currentOrder = await getOrderById(orderId);

  if (currentOrder.production_status === 'delivered') {
    throw new AppError('Delivered orders cannot be cancelled.', 400, 'CANNOT_CANCEL_DELIVERED');
  }

  if (currentOrder.production_status === 'cancelled') {
    throw new AppError('Order is already cancelled.', 400, 'ORDER_ALREADY_CANCELLED');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('UPDATE orders SET production_status = $1 WHERE id = $2', ['cancelled', orderId]);

    const historyNote = notes || 'Order cancelled';
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, notes)
       VALUES ($1, 'cancelled', $2, $3)`,
      [orderId, userId, historyNote]
    );

    await client.query('COMMIT');
    return getOrderById(orderId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Reverses inventory consumption for a cancelled order.
 * Creates offsetting 'return' inventory_transactions rows.
 * Never deletes original audit records!
 */
export async function restoreOrderInventory(orderId: number, userId: number) {
  const order = await getOrderById(orderId);

  if (order.production_status !== 'cancelled') {
    throw new AppError('Inventory can only be restored for cancelled orders.', 400, 'ORDER_NOT_CANCELLED');
  }

  if (!order.has_consumed_inventory) {
    throw new AppError('This order did not consume any inventory, so there is nothing to restore.', 400, 'NO_INVENTORY_CONSUMED');
  }

  if (order.has_restored_inventory) {
    throw new AppError('Inventory for this order has already been restored.', 400, 'INVENTORY_ALREADY_RESTORED');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find all original consumption transactions for this order
    const consumptionTxs = await client.query(
      `SELECT * FROM inventory_transactions 
       WHERE reference_type = 'order' AND reference_id = $1 AND transaction_type = 'order_consumption'`,
      [orderId]
    );

    const restoredItems: any[] = [];

    for (const tx of consumptionTxs.rows) {
      const qtyToRestore = Math.abs(parseFloat(tx.quantity_change));
      const itemId = tx.inventory_item_id;

      // Lock and update item quantity
      const itemRes = await client.query(
        'SELECT current_quantity FROM inventory_items WHERE id = $1 FOR UPDATE',
        [itemId]
      );

      if (itemRes.rows.length > 0) {
        const currentQty = parseFloat(itemRes.rows[0].current_quantity);
        const restoredQty = parseFloat((currentQty + qtyToRestore).toFixed(2));

        await client.query(
          'UPDATE inventory_items SET current_quantity = $1 WHERE id = $2',
          [restoredQty, itemId]
        );

        // Create offsetting transaction entry
        const restoreTx = await client.query(
          `INSERT INTO inventory_transactions (
            inventory_item_id, transaction_type, quantity_change,
            reference_type, reference_id, cost_at_time, created_by
          ) VALUES ($1, 'return', $2, 'order_cancellation_restore', $3, $4, $5)
          RETURNING *`,
          [
            itemId,
            qtyToRestore,
            orderId,
            tx.cost_at_time,
            userId,
          ]
        );

        restoredItems.push({
          inventory_item_id: itemId,
          quantity_restored: qtyToRestore,
          new_stock: restoredQty,
          transaction_id: restoreTx.rows[0].id,
        });
      }
    }

    // Log status history note
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, notes)
       VALUES ($1, 'cancelled', $2, 'Inventory restored back to stock following order cancellation')`,
      [orderId, userId]
    );

    await client.query('COMMIT');

    return {
      order_id: orderId,
      order_number: order.order_number,
      restored_items_count: restoredItems.length,
      restored_materials: restoredItems,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Calculates order profitability:
 * - Revenue: subtotal (or total_amount)
 * - Actual material cost from inventory_transactions at consumption time
 * - Gross profit and gross margin %
 */
export async function getOrderProfitability(orderId: number) {
  const order = await getOrderById(orderId);

  // 1. Calculate actual raw material cost from consumption transactions
  const consumptionTxRes = await pool.query(
    `
    SELECT 
      it.inventory_item_id,
      ii.name AS material_name,
      ii.unit AS material_unit,
      ABS(it.quantity_change)::numeric(12,4) AS consumed_quantity,
      it.cost_at_time,
      (ABS(it.quantity_change) * it.cost_at_time)::numeric(12,2) AS line_material_cost
    FROM inventory_transactions it
    JOIN inventory_items ii ON ii.id = it.inventory_item_id
    WHERE it.reference_type = 'order' AND it.reference_id = $1 AND it.transaction_type = 'order_consumption'
    `,
    [orderId]
  );

  let materialCost = 0;
  let isEstimated = false;

  let materialsCostBreakdown: any[] = [];

  if (consumptionTxRes.rows.length > 0) {
    materialsCostBreakdown = consumptionTxRes.rows.map((row) => ({
      material_name: row.material_name,
      consumed_quantity: parseFloat(row.consumed_quantity),
      unit: row.material_unit,
      cost_at_consumption: parseFloat(row.cost_at_time),
      total_cost: parseFloat(row.line_material_cost),
    }));

    materialCost = materialsCostBreakdown.reduce((acc, curr) => acc + curr.total_cost, 0);
  } else {
    // If not consumed yet, calculate estimated material cost from current BOM
    isEstimated = true;
    const reqs = await getOrderMaterialRequirements(orderId);
    materialCost = reqs.total_raw_material_cost;
    materialsCostBreakdown = reqs.materials_breakdown.map((m) => ({
      material_name: m.material_name,
      consumed_quantity: m.required_quantity,
      unit: m.unit,
      cost_at_consumption: m.unit_cost,
      total_cost: m.estimated_cost,
    }));
  }

  const revenue = parseFloat(order.subtotal);
  const totalBilled = parseFloat(order.total_amount);
  const grossProfit = parseFloat((revenue - materialCost).toFixed(2));
  const grossMarginPercentage = revenue > 0 ? parseFloat(((grossProfit / revenue) * 100).toFixed(2)) : 0;

  return {
    order_id: order.id,
    order_number: order.order_number,
    production_status: order.production_status,
    is_cost_estimated: isEstimated,
    financials: {
      subtotal_revenue: revenue,
      discount: parseFloat(order.discount),
      tax: parseFloat(order.tax),
      total_billed: totalBilled,
      total_material_cost: parseFloat(materialCost.toFixed(2)),
      gross_profit: grossProfit,
      gross_margin_percentage: grossMarginPercentage,
    },
    materials_cost_breakdown: materialsCostBreakdown,
  };
}
