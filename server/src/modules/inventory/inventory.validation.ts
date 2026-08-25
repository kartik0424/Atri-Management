import { z } from 'zod';

export const transactionTypeEnum = z.enum([
  'purchase',
  'order_consumption',
  'manual_adjustment',
  'return',
  'damaged',
  'stock_correction',
  'transfer',
]);

export const createInventoryItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  category: z.string().optional().nullable(),
  unit: z.string().default('piece'),
  current_quantity: z.coerce.number().min(0, 'Initial quantity must be non-negative').default(0),
  minimum_stock_level: z.coerce.number().min(0, 'Minimum stock level must be non-negative').default(0),
  purchase_price: z.coerce.number().min(0, 'Purchase price must be non-negative').default(0),
  average_cost: z.coerce.number().min(0, 'Average cost must be non-negative').default(0),
  supplier_id: z.coerce.number().int().positive().optional().nullable(),
  storage_location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateInventoryItemSchema = createInventoryItemSchema
  .partial()
  .omit({ current_quantity: true }); // Disallow direct quantity updates via PUT — must use /adjust

export const inventoryFilterEnum = z.enum(['low_stock', 'out_of_stock', 'all']);

export const inventoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  supplier_id: z.coerce.number().int().positive().optional(),
  filter: inventoryFilterEnum.optional().default('all'),
});

export const inventoryIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid inventory item ID'),
});

export const adjustStockSchema = z.object({
  quantity_change: z.coerce.number().refine((val) => val !== 0, {
    message: 'Quantity change cannot be 0',
  }),
  transaction_type: transactionTypeEnum.default('manual_adjustment'),
  reference_type: z.string().optional().nullable(),
  reference_id: z.coerce.number().int().positive().optional().nullable(),
  cost_at_time: z.coerce.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  allow_negative: z.boolean().optional().default(false),
  reason: z.string().optional(),
}).refine(
  (data) => {
    // If allow_negative is requested, a reason is required
    if (data.allow_negative && (!data.reason || data.reason.trim().length < 5)) {
      return false;
    }
    return true;
  },
  {
    message: 'A descriptive reason (min 5 characters) is required when allowing negative stock override',
    path: ['reason'],
  }
);

export const transactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  transaction_type: transactionTypeEnum.optional(),
});

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type InventoryQueryParams = z.infer<typeof inventoryQuerySchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type TransactionsQueryParams = z.infer<typeof transactionsQuerySchema>;
