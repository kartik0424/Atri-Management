import pool from '../../db/pool.js';
import { NotFoundError, AppError } from '../../utils/errors.js';
import {
  CreateProductInput,
  UpdateProductInput,
  ProductQueryParams,
  AddMaterialInput,
} from './products.validation.js';

export async function listProducts(params: ProductQueryParams) {
  const { page, limit, search, category, active } = params;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(p.name ILIKE $${paramIdx} OR p.category ILIKE $${paramIdx})`);
    values.push(`%${search}%`);
    paramIdx++;
  }

  if (category) {
    conditions.push(`p.category = $${paramIdx}`);
    values.push(category);
    paramIdx++;
  }

  if (active !== 'all') {
    conditions.push(`p.active = $${paramIdx}`);
    values.push(active === 'true');
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM products p ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const query = `
    SELECT 
      p.*,
      COUNT(DISTINCT pm.inventory_item_id)::int AS materials_count,
      COUNT(DISTINCT oi.id)::int AS times_ordered
    FROM products p
    LEFT JOIN product_materials pm ON pm.product_id = p.id
    LEFT JOIN order_items oi ON oi.product_id = p.id
    ${whereClause}
    GROUP BY p.id
    ORDER BY p.name ASC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  values.push(limit, offset);
  const result = await pool.query(query, values);

  return {
    products: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getProductById(id: number) {
  const productRes = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  if (productRes.rows.length === 0) {
    throw new NotFoundError(`Product with ID ${id} not found`);
  }

  const materialsRes = await pool.query(
    `
    SELECT 
      pm.product_id,
      pm.inventory_item_id,
      pm.quantity_required_per_unit,
      ii.name AS material_name,
      ii.category AS material_category,
      ii.unit AS material_unit,
      ii.current_quantity AS in_stock,
      ii.average_cost,
      (pm.quantity_required_per_unit * ii.average_cost)::numeric(12,2) AS estimated_material_cost_per_unit
    FROM product_materials pm
    JOIN inventory_items ii ON ii.id = pm.inventory_item_id
    WHERE pm.product_id = $1
    ORDER BY ii.name ASC
    `,
    [id]
  );

  const product = productRes.rows[0];
  const materials = materialsRes.rows;
  const totalEstimatedCost = materials.reduce(
    (sum, m) => sum + parseFloat(m.estimated_material_cost_per_unit || 0),
    0
  );

  return {
    ...product,
    estimated_cost: parseFloat(totalEstimatedCost.toFixed(2)),
    materials,
  };
}

export async function createProduct(input: CreateProductInput) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO products (name, category, unit, default_selling_price, active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.name.trim(),
        input.category || null,
        input.unit,
        input.default_selling_price,
        input.active,
      ]
    );

    const product = result.rows[0];

    if (input.materials && input.materials.length > 0) {
      for (const mat of input.materials) {
        // Check if inventory item exists
        const itemCheck = await client.query('SELECT id FROM inventory_items WHERE id = $1', [
          mat.inventory_item_id,
        ]);
        if (itemCheck.rows.length === 0) {
          throw new NotFoundError(`Inventory item with ID ${mat.inventory_item_id} not found`);
        }

        await client.query(
          `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit)
           VALUES ($1, $2, $3)`,
          [product.id, mat.inventory_item_id, mat.quantity_required_per_unit]
        );
      }
    }

    await client.query('COMMIT');
    return getProductById(product.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateProduct(id: number, input: UpdateProductInput) {
  await getProductById(id);

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
  if (input.default_selling_price !== undefined) {
    fields.push(`default_selling_price = $${paramIdx++}`);
    values.push(input.default_selling_price);
  }
  if (input.active !== undefined) {
    fields.push(`active = $${paramIdx++}`);
    values.push(input.active);
  }

  if (fields.length > 0) {
    values.push(id);
    const query = `
      UPDATE products 
      SET ${fields.join(', ')} 
      WHERE id = $${paramIdx} 
      RETURNING *
    `;
    await pool.query(query, values);
  }

  return getProductById(id);
}

export async function deleteProduct(id: number) {
  await getProductById(id);

  // Check if product is referenced in order_items
  const orderCheck = await pool.query('SELECT COUNT(*) FROM order_items WHERE product_id = $1', [id]);
  if (parseInt(orderCheck.rows[0].count, 10) > 0) {
    throw new AppError(
      `Cannot delete product. It is referenced in ${orderCheck.rows[0].count} historical order item(s). Set active = false instead.`,
      400,
      'PRODUCT_HAS_ORDERS'
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Remove materials links first
    await client.query('DELETE FROM product_materials WHERE product_id = $1', [id]);
    await client.query('DELETE FROM products WHERE id = $1', [id]);
    await client.query('COMMIT');
    return { deleted: true, id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Product Materials (Recipe BOM)
export async function getMaterials(productId: number) {
  await getProductById(productId);

  const result = await pool.query(
    `
    SELECT 
      pm.product_id,
      pm.inventory_item_id,
      pm.quantity_required_per_unit,
      ii.name AS material_name,
      ii.category AS material_category,
      ii.unit AS material_unit,
      ii.current_quantity AS in_stock,
      ii.minimum_stock_level,
      ii.average_cost
    FROM product_materials pm
    JOIN inventory_items ii ON ii.id = pm.inventory_item_id
    WHERE pm.product_id = $1
    ORDER BY ii.name ASC
    `,
    [productId]
  );

  return result.rows;
}

export async function addMaterial(productId: number, input: AddMaterialInput) {
  await getProductById(productId);

  // Check inventory item exists
  const itemCheck = await pool.query('SELECT id FROM inventory_items WHERE id = $1', [
    input.inventory_item_id,
  ]);
  if (itemCheck.rows.length === 0) {
    throw new NotFoundError(`Inventory item with ID ${input.inventory_item_id} not found`);
  }

  const result = await pool.query(
    `INSERT INTO product_materials (product_id, inventory_item_id, quantity_required_per_unit)
     VALUES ($1, $2, $3)
     ON CONFLICT (product_id, inventory_item_id) 
     DO UPDATE SET quantity_required_per_unit = EXCLUDED.quantity_required_per_unit
     RETURNING *`,
    [productId, input.inventory_item_id, input.quantity_required_per_unit]
  );

  return result.rows[0];
}

export async function updateMaterial(
  productId: number,
  inventoryItemId: number,
  quantityRequiredPerUnit: number
) {
  await getProductById(productId);

  const result = await pool.query(
    `UPDATE product_materials 
     SET quantity_required_per_unit = $1
     WHERE product_id = $2 AND inventory_item_id = $3
     RETURNING *`,
    [quantityRequiredPerUnit, productId, inventoryItemId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError(
      `Material with inventory_item_id ${inventoryItemId} not part of product recipe for ID ${productId}`
    );
  }

  return result.rows[0];
}

export async function removeMaterial(productId: number, inventoryItemId: number) {
  await getProductById(productId);

  const result = await pool.query(
    'DELETE FROM product_materials WHERE product_id = $1 AND inventory_item_id = $2 RETURNING *',
    [productId, inventoryItemId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError(
      `Material with inventory_item_id ${inventoryItemId} not found in recipe for product ${productId}`
    );
  }

  return { deleted: true, product_id: productId, inventory_item_id: inventoryItemId };
}

// Calculate material requirements for a given order quantity
export async function calculateMaterialRequirements(productId: number, orderQuantity: number) {
  const product = await getProductById(productId);
  const materials = await getMaterials(productId);

  let hasShortage = false;

  const requirements = materials.map((mat) => {
    const totalRequired = parseFloat((mat.quantity_required_per_unit * orderQuantity).toFixed(4));
    const inStock = parseFloat(mat.in_stock);
    const shortage = Math.max(0, parseFloat((totalRequired - inStock).toFixed(4)));
    const isSufficient = inStock >= totalRequired;

    if (!isSufficient) {
      hasShortage = true;
    }

    return {
      inventory_item_id: mat.inventory_item_id,
      material_name: mat.material_name,
      material_category: mat.material_category,
      unit: mat.material_unit,
      quantity_required_per_unit: parseFloat(mat.quantity_required_per_unit),
      total_quantity_required: totalRequired,
      current_in_stock: inStock,
      is_sufficient: isSufficient,
      shortage_amount: shortage,
      average_cost: parseFloat(mat.average_cost),
      estimated_total_cost: parseFloat((totalRequired * parseFloat(mat.average_cost)).toFixed(2)),
    };
  });

  const totalCost = requirements.reduce((acc, curr) => acc + curr.estimated_total_cost, 0);

  return {
    product: {
      id: product.id,
      name: product.name,
      unit: product.unit,
      default_selling_price: parseFloat(product.default_selling_price),
    },
    order_quantity: orderQuantity,
    can_fulfill_from_stock: !hasShortage,
    total_estimated_raw_material_cost: parseFloat(totalCost.toFixed(2)),
    materials_breakdown: requirements,
  };
}
