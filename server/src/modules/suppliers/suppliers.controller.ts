import { Request, Response, NextFunction } from 'express';
import * as supplierService from './suppliers.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function listSuppliers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await supplierService.listSuppliers(req.query as any);
    return sendSuccess(res, result.suppliers, { pagination: result.pagination });
  } catch (error) {
    next(error);
  }
}

export async function getSupplierById(req: Request, res: Response, next: NextFunction) {
  try {
    const supplier = await supplierService.getSupplierById(Number(req.params.id));
    return sendSuccess(res, supplier);
  } catch (error) {
    next(error);
  }
}

export async function createSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const supplier = await supplierService.createSupplier(req.body);
    return sendSuccess(res, supplier, { statusCode: 201, message: 'Supplier created successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updateSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const supplier = await supplierService.updateSupplier(Number(req.params.id), req.body);
    return sendSuccess(res, supplier, { message: 'Supplier updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function deleteSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await supplierService.deleteSupplier(Number(req.params.id));
    return sendSuccess(res, result, { message: 'Supplier deleted successfully' });
  } catch (error) {
    next(error);
  }
}
