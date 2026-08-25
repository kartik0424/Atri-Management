import { Router } from 'express';
import * as productController from './products.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../../middleware/validate.js';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
  productIdParamSchema,
  materialRequirementQuerySchema,
  addMaterialSchema,
  updateMaterialSchema,
  materialParamSchema,
} from './products.validation.js';

export const productsRouter = Router();

// All product endpoints require auth
productsRouter.use(requireAuth);

productsRouter.get('/', validateQuery(productQuerySchema), productController.listProducts);
productsRouter.post('/', validateBody(createProductSchema), productController.createProduct);
productsRouter.get('/:id', validateParams(productIdParamSchema), productController.getProductById);
productsRouter.put(
  '/:id',
  validateParams(productIdParamSchema),
  validateBody(updateProductSchema),
  productController.updateProduct
);
productsRouter.delete('/:id', validateParams(productIdParamSchema), productController.deleteProduct);

// Material requirements calculator for orders
productsRouter.get(
  '/:id/material-requirements',
  validateParams(productIdParamSchema),
  validateQuery(materialRequirementQuerySchema),
  productController.getMaterialRequirements
);

// Nested Product Materials (Recipe BOM)
productsRouter.get(
  '/:id/materials',
  validateParams(productIdParamSchema),
  productController.getMaterials
);
productsRouter.post(
  '/:id/materials',
  validateParams(productIdParamSchema),
  validateBody(addMaterialSchema),
  productController.addMaterial
);
productsRouter.put(
  '/:id/materials/:inventoryItemId',
  validateParams(materialParamSchema),
  validateBody(updateMaterialSchema),
  productController.updateMaterial
);
productsRouter.delete(
  '/:id/materials/:inventoryItemId',
  validateParams(materialParamSchema),
  productController.removeMaterial
);
