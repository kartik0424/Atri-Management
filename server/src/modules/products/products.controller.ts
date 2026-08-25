import { Request, Response, NextFunction } from 'express';
import * as productService from './products.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await productService.listProducts(req.query as any);
    return sendSuccess(res, result.products, { pagination: result.pagination });
  } catch (error) {
    next(error);
  }
}

export async function getProductById(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productService.getProductById(Number(req.params.id));
    return sendSuccess(res, product);
  } catch (error) {
    next(error);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productService.createProduct(req.body);
    return sendSuccess(res, product, { statusCode: 201, message: 'Product created successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productService.updateProduct(Number(req.params.id), req.body);
    return sendSuccess(res, product, { message: 'Product updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await productService.deleteProduct(Number(req.params.id));
    return sendSuccess(res, result, { message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function getMaterials(req: Request, res: Response, next: NextFunction) {
  try {
    const materials = await productService.getMaterials(Number(req.params.id));
    return sendSuccess(res, materials);
  } catch (error) {
    next(error);
  }
}

export async function addMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const material = await productService.addMaterial(Number(req.params.id), req.body);
    return sendSuccess(res, material, {
      statusCode: 201,
      message: 'Material added to product recipe',
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const material = await productService.updateMaterial(
      Number(req.params.id),
      Number(req.params.inventoryItemId),
      req.body.quantity_required_per_unit
    );
    return sendSuccess(res, material, { message: 'Recipe material updated' });
  } catch (error) {
    next(error);
  }
}

export async function removeMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await productService.removeMaterial(
      Number(req.params.id),
      Number(req.params.inventoryItemId)
    );
    return sendSuccess(res, result, { message: 'Material removed from recipe' });
  } catch (error) {
    next(error);
  }
}

export async function getMaterialRequirements(req: Request, res: Response, next: NextFunction) {
  try {
    const quantity = Number(req.query.quantity);
    const requirements = await productService.calculateMaterialRequirements(
      Number(req.params.id),
      quantity
    );
    return sendSuccess(res, requirements);
  } catch (error) {
    next(error);
  }
}
