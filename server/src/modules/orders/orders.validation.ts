import { z } from 'zod';

export const productionStatusEnum = z.enum([
  'received',
  'design',
  'production',
  'quality_check',
  'ready',
  'delivered',
  'cancelled',
]);

export const paymentStatusEnum = z.enum([
  'unpaid',
  'partially_paid',
  'paid',
  'overpaid',
]);

export const orderItemInputSchema = z.object({
  product_id: z.coerce.number().int().positive('Invalid product ID'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unit_price: z.coerce.number().min(0, 'Unit price must be non-negative').optional(),
  discount: z.coerce.number().min(0, 'Discount must be non-negative').default(0),
  tax: z.coerce.number().min(0, 'Tax must be non-negative').default(0),
});

export const createOrderSchema = z.object({
  client_id: z.coerce.number().int().positive('Invalid client ID'),
  order_date: z.string().optional(),
  expected_delivery_date: z.string().optional().nullable(),
  items: z.array(orderItemInputSchema).min(1, 'Order must contain at least one line item'),
  notes: z.string().optional().nullable(),
  internal_notes: z.string().optional().nullable(),
});

export const updateOrderSchema = z.object({
  client_id: z.coerce.number().int().positive().optional(),
  expected_delivery_date: z.string().optional().nullable(),
  items: z.array(orderItemInputSchema).min(1).optional(),
  notes: z.string().optional().nullable(),
  internal_notes: z.string().optional().nullable(),
});

export const updateStatusSchema = z.object({
  status: productionStatusEnum,
  notes: z.string().optional().nullable(),
  force: z.boolean().optional().default(false),
  reason: z.string().optional(),
}).refine(
  (data) => {
    if (data.force && (!data.reason || data.reason.trim().length < 5)) {
      return false;
    }
    return true;
  },
  {
    message: 'A descriptive reason (min 5 characters) is required when forcing production with insufficient stock',
    path: ['reason'],
  }
);

export const cancelOrderSchema = z.object({
  notes: z.string().optional().nullable(),
});

export const orderQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  production_status: productionStatusEnum.optional(),
  payment_status: paymentStatusEnum.optional(),
  status: z.string().optional(), // alias for status search
  client_id: z.coerce.number().int().positive().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  search: z.string().optional(),
});

export const orderIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid order ID'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type OrderQueryParams = z.infer<typeof orderQuerySchema>;
