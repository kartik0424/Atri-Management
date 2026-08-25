import { Router } from 'express';
import * as orderController from './orders.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../../middleware/validate.js';
import {
  createOrderSchema,
  updateOrderSchema,
  updateStatusSchema,
  cancelOrderSchema,
  orderQuerySchema,
  orderIdParamSchema,
} from './orders.validation.js';

export const ordersRouter = Router();

// All order endpoints require authentication
ordersRouter.use(requireAuth);

// Order List & Creation
ordersRouter.get('/', validateQuery(orderQuerySchema), orderController.listOrders);
ordersRouter.post('/', validateBody(createOrderSchema), orderController.createOrder);

// Order Detail & Edit
ordersRouter.get('/:id', validateParams(orderIdParamSchema), orderController.getOrderById);
ordersRouter.put(
  '/:id',
  validateParams(orderIdParamSchema),
  validateBody(updateOrderSchema),
  orderController.updateOrder
);

// Repeat Order (Duplication)
ordersRouter.post('/:id/duplicate', validateParams(orderIdParamSchema), orderController.duplicateOrder);

// Material Requirements Calculation
ordersRouter.get(
  '/:id/material-requirements',
  validateParams(orderIdParamSchema),
  orderController.getOrderMaterialRequirements
);

// Status Transition Workflow (Consumes inventory on 'production')
ordersRouter.post(
  '/:id/status',
  validateParams(orderIdParamSchema),
  validateBody(updateStatusSchema),
  orderController.updateOrderStatus
);

// Cancellation
ordersRouter.post(
  '/:id/cancel',
  validateParams(orderIdParamSchema),
  validateBody(cancelOrderSchema),
  orderController.cancelOrder
);

// Reverse Inventory Consumption for Cancelled Order
ordersRouter.post(
  '/:id/restore-inventory',
  validateParams(orderIdParamSchema),
  orderController.restoreOrderInventory
);

// Order Profitability Analytics
ordersRouter.get(
  '/:id/profitability',
  validateParams(orderIdParamSchema),
  orderController.getOrderProfitability
);
