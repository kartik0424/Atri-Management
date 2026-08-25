import { Router } from 'express';
import * as supplierController from './suppliers.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../../middleware/validate.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierQuerySchema,
  supplierIdParamSchema,
} from './suppliers.validation.js';

export const suppliersRouter = Router();

// All supplier routes require authentication
suppliersRouter.use(requireAuth);

suppliersRouter.get('/', validateQuery(supplierQuerySchema), supplierController.listSuppliers);
suppliersRouter.post('/', validateBody(createSupplierSchema), supplierController.createSupplier);
suppliersRouter.get('/:id', validateParams(supplierIdParamSchema), supplierController.getSupplierById);
suppliersRouter.put(
  '/:id',
  validateParams(supplierIdParamSchema),
  validateBody(updateSupplierSchema),
  supplierController.updateSupplier
);
suppliersRouter.delete(
  '/:id',
  validateParams(supplierIdParamSchema),
  supplierController.deleteSupplier
);
