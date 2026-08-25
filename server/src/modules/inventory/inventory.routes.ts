import { Router } from 'express';
import * as inventoryController from './inventory.controller.js';
import { requireAuth, restrictEmployeeDelete } from '../../middleware/auth.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../../middleware/validate.js';
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  inventoryQuerySchema,
  inventoryIdParamSchema,
  adjustStockSchema,
  transactionsQuerySchema,
} from './inventory.validation.js';

export const inventoryRouter = Router();

// All inventory endpoints require authentication
inventoryRouter.use(requireAuth);

inventoryRouter.get('/', validateQuery(inventoryQuerySchema), inventoryController.listInventoryItems);
inventoryRouter.post('/', validateBody(createInventoryItemSchema), inventoryController.createItem);
inventoryRouter.get('/:id', validateParams(inventoryIdParamSchema), inventoryController.getItemById);
inventoryRouter.put(
  '/:id',
  validateParams(inventoryIdParamSchema),
  validateBody(updateInventoryItemSchema),
  inventoryController.updateItem
);

// Manual stock adjustment endpoint (Strict audit trail)
inventoryRouter.post(
  '/:id/adjust',
  validateParams(inventoryIdParamSchema),
  validateBody(adjustStockSchema),
  inventoryController.adjustStock
);

// Item transaction audit history
inventoryRouter.get(
  '/:id/transactions',
  validateParams(inventoryIdParamSchema),
  validateQuery(transactionsQuerySchema),
  inventoryController.getItemTransactions
);

// Employees restricted from deleting inventory items
inventoryRouter.delete(
  '/:id',
  validateParams(inventoryIdParamSchema),
  restrictEmployeeDelete,
  inventoryController.deleteItem
);
