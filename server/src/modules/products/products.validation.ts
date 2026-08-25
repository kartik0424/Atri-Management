import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  category: z.string().optional().nullable(),
  unit: z.string().default('piece'),
  default_selling_price: z.coerce.number().min(0, 'Selling price must be non-negative').default(0),
  active: z.boolean().default(true),
  materials: z.array(z.object({
    inventory_item_id: z.coerce.number().int().positive(),
    quantity_required_per_unit: z.coerce.number().positive('Quantity required per unit must be greater than 0'),
  })).optional(),
});

export const updateProductSchema = createProductSchema.partial().omit({ materials: true });

export const productQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  active: z.enum(['true', 'false', 'all']).optional().default('all'),
});

export const productIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid product ID'),
});

export const materialRequirementQuerySchema = z.object({
  quantity: z.coerce.number().positive('Order quantity must be positive'),
});

export const addMaterialSchema = z.object({
  inventory_item_id: z.coerce.number().int().positive('Invalid inventory item ID'),
  quantity_required_per_unit: z.coerce.number().positive('Quantity required per unit must be greater than 0'),
});

export const updateMaterialSchema = z.object({
  quantity_required_per_unit: z.coerce.number().positive('Quantity required per unit must be greater than 0'),
});

export const materialParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid product ID'),
  inventoryItemId: z.coerce.number().int().positive('Invalid inventory item ID'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryParams = z.infer<typeof productQuerySchema>;
export type AddMaterialInput = z.infer<typeof addMaterialSchema>;
