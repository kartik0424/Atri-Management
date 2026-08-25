import pool from '../../db/pool.js';
import { NotFoundError, AppError } from '../../utils/errors.js';
import {
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  InventoryQueryParams,
  AdjustStockInput,
  TransactionsQueryParams,
} from './inventory.validation.js';

export async function listInventoryItems(params: InventoryQueryParams) {
  const { page, limit, search, category, supplier_id, filter } = params;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(ii.name ILIKE $${paramIdx} OR ii.category ILIKE $${paramIdx} OR ii.storage_location ILIKE $${paramIdx})`);
    values.push(`%${search}%`);
    paramIdx++;
  }

  if (category) {
    conditions.push(`ii.category = $${paramIdx}`);
    values.push(category);
    paramIdx++;
  }

  if (supplier_id) {
    conditions.push(`ii.supplier_id = $${paramIdx}`);
    values.push(supplier_id);
    paramIdx++;
  }

  if (filter === 'low_stock') {
    conditions.push(`ii.current_quantity <= ii.minimum_stock_level AND ii.current_quantity > 0`);
  } else if (filter === 'out_of_stock') {
    conditions.push(`ii.current_quantity <= 0`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM inventory_items ii ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const query = `
    SELECT 
      ii.*,
      s.name AS supplier_name,
      (ii.current_quantity <= ii.minimum_stock_level) AS is_low_stock,
      (ii.current_quantity <= 0) AS is_out_of_stock,
      (ii.current_quantity * ii.average_cost)::numeric(12,2) AS total_inventory_value
    FROM inventory_items ii
    LEFT JOIN suppliers s ON s.id = ii.supplier_id
    ${whereClause}
    ORDER BY (ii.current_quantity <= ii.minimum_stock_level) DESC, ii.name ASC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  values.push(limit, offset);
  const result = await pool.query(query, values);

  return {
    items: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getItemById(id: number) {
  const result = await pool.query(
    `
    SELECT 
      ii.*,
      s.name AS supplier_name,
      s.contact_person AS supplier_contact,
      s.mobile AS supplier_mobile,
      (ii.current_quantity <= ii.minimum_stock_level) AS is_low_stock,
      (ii.current_quantity <= 0) AS is_out_of_stock,
      (ii.current_quantity * ii.average_cost)::numeric(12,2) AS total_inventory_value
    FROM inventory_items ii
    LEFT JOIN suppliers s ON s.id = ii.supplier_id
    WHERE ii.id = $1
    `,
    [id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError(`Inventory item with ID ${id} not found`);
  }

  return result.rows[0];
}

export async function createItem(input: CreateInventoryItemInput, userId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (input.supplier_id) {
      const supCheck = await client.query('SELECT id FROM suppliers WHERE id = $1', [input.supplier_id]);
      if (supCheck.rows.length === 0) {
        throw new NotFoundError(`Supplier with ID ${input.supplier_id} not found`);
      }
    }

    const result = await client.query(
      `INSERT INTO inventory_items (
        name, category, unit, current_quantity, minimum_stock_level,
        purchase_price, average_cost, supplier_id, storage_location, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        input.name.trim(),
        input.category || null,
        input.unit,
        input.current_quantity,
        input.minimum_stock_level,
        input.purchase_price,
        input.average_cost || input.purchase_price,
        input.supplier_id || null,
        input.storage_location || null,
        input.notes || null,
      ]
    );

    const newItem = result.rows[0];

    // Audit trail: If created with an initial stock > 0, log an initial stock transaction
    if (parseFloat(newItem.current_quantity) > 0) {
      await client.query(
        `INSERT INTO inventory_transactions (
          inventory_item_id, transaction_type, quantity_change,
          reference_type, reference_id, cost_at_time, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newItem.id,
          'manual_adjustment',
          newItem.current_quantity,
          'initial_stock',
          newItem.id,
          newItem.average_cost,
          userId,
        ]
      );
    }

    await client.query('COMMIT');
    return getItemById(newItem.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateItem(id: number, input: UpdateInventoryItemInput) {
  await getItemById(id);

  const fields: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (input.name !== undefined) {
    fields.push(`name = $${paramIdx++}`);
    values.push(input.name.trim());
  }
  if (input.category !== undefined) {
    fields.push(`category = $${paramIdx++}`);
    values.push(input.category || null);
  }
  if (input.unit !== undefined) {
    fields.push(`unit = $${paramIdx++}`);
    values.push(input.unit);
  }
  if (input.minimum_stock_level !== undefined) {
    fields.push(`minimum_stock_level = $${paramIdx++}`);
    values.push(input.minimum_stock_level);
  }
  if (input.purchase_price !== undefined) {
    fields.push(`purchase_price = $${paramIdx++}`);
    values.push(input.purchase_price);
  }
  if (input.average_cost !== undefined) {
    fields.push(`average_cost = $${paramIdx++}`);
    values.push(input.average_cost);
  }
  if (input.supplier_id !== undefined) {
    fields.push(`supplier_id = $${paramIdx++}`);
    values.push(input.supplier_id || null);
  }
  if (input.storage_location !== undefined) {
    fields.push(`storage_location = $${paramIdx++}`);
    values.push(input.storage_location || null);
  }
  if (input.notes !== undefined) {
    fields.push(`notes = $${paramIdx++}`);
    values.push(input.notes || null);
  }

  if (fields.length > 0) {
    values.push(id);
    const query = `
      UPDATE inventory_items 
      SET ${fields.join(', ')} 
      WHERE id = $${paramIdx} 
      RETURNING *
    `;
    await pool.query(query, values);
  }

  return getItemById(id);
}

/**
 * Adjust stock endpoint:
 * 1. ALWAYS creates an inventory_transactions row
 * 2. NEVER updates current_quantity without one
 * 3. REJECTS any adjustment that would result in negative stock unless allow_negative + reason is supplied
 */
export async function adjustStock(
  itemId: number,
  input: AdjustStockInput,
  userId: number
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock item row for update
    const itemRes = await client.query(
      'SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE',
      [itemId]
    );

    if (itemRes.rows.length === 0) {
      throw new NotFoundError(`Inventory item with ID ${itemId} not found`);
    }

    const item = itemRes.rows[0];
    const currentQty = parseFloat(item.current_quantity);
    const change = parseFloat(input.quantity_change.toString());
    const resultingQty = parseFloat((currentQty + change).toFixed(2));

    // 2. Check for negative stock
    if (resultingQty < 0 && !input.allow_negative) {
      throw new AppError(
        `Insufficient stock for "${item.name}". Current stock: ${currentQty} ${item.unit}. Requested change: ${change} ${item.unit}. Resulting stock would be ${resultingQty} ${item.unit}. To proceed with negative stock, supply allow_negative: true and a valid reason.`,
        400,
        'INSUFFICIENT_STOCK_WARNING',
        {
          item_id: itemId,
          item_name: item.name,
          unit: item.unit,
          current_quantity: currentQty,
          requested_change: change,
          resulting_quantity: resultingQty,
        }
      );
    }

    const costAtTime = input.cost_at_time !== undefined ? input.cost_at_time : item.average_cost;

    // 3. Create inventory transaction row
    const txRes = await client.query(
      `INSERT INTO inventory_transactions (
        inventory_item_id, transaction_type, quantity_change,
        reference_type, reference_id, cost_at_time, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        itemId,
        input.transaction_type,
        change,
        input.reference_type || (input.allow_negative ? 'negative_stock_override' : 'manual_adjustment'),
        input.reference_id || null,
        costAtTime,
        userId,
      ]
    );

    // 4. Update current_quantity on item
    const updatedItemRes = await client.query(
      `UPDATE inventory_items 
       SET current_quantity = $1 
       WHERE id = $2 
       RETURNING *`,
      [resultingQty, itemId]
    );

    await client.query('COMMIT');

    return {
      item: updatedItemRes.rows[0],
      transaction: txRes.rows[0],
      previous_quantity: currentQty,
      new_quantity: resultingQty,
      override_applied: resultingQty < 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getItemTransactions(itemId: number, params: TransactionsQueryParams) {
  await getItemById(itemId); // Ensure exists

  const { page, limit, transaction_type } = params;
  const offset = (page - 1) * limit;

  const conditions: string[] = ['it.inventory_item_id = $1'];
  const values: any[] = [itemId];
  let paramIdx = 2;

  if (transaction_type) {
    conditions.push(`it.transaction_type = $${paramIdx}`);
    values.push(transaction_type);
    paramIdx++;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM inventory_transactions it ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const query = `
    SELECT 
      it.*,
      u.name AS created_by_name,
      u.email AS created_by_email,
      u.role AS created_by_role
    FROM inventory_transactions it
    LEFT JOIN users u ON u.id = it.created_by
    ${whereClause}
    ORDER BY it.created_at DESC, it.id DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  values.push(limit, offset);
  const result = await pool.query(query, values);

  return {
    transactions: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function deleteItem(id: number) {
  await getItemById(id);

  // Check if item is used in recipes
  const recipeCheck = await pool.query(
    'SELECT COUNT(*) FROM product_materials WHERE inventory_item_id = $1',
    [id]
  );
  if (parseInt(recipeCheck.rows[0].count, 10) > 0) {
    throw new AppError(
      `Cannot delete inventory item. It is part of ${recipeCheck.rows[0].count} product material recipe(s). Remove it from recipes first.`,
      400,
      'ITEM_IN_RECIPES'
    );
  }

  // Check if item has purchase history
  const purchaseCheck = await pool.query(
    'SELECT COUNT(*) FROM purchase_items WHERE inventory_item_id = $1',
    [id]
  );
  if (parseInt(purchaseCheck.rows[0].count, 10) > 0) {
    throw new AppError(
      `Cannot delete inventory item with historical purchases. Protected by database policy.`,
      400,
      'ITEM_IN_PURCHASES'
    );
  }

  await pool.query('DELETE FROM inventory_items WHERE id = $1', [id]);
  return { deleted: true, id };
}
