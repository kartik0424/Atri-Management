import { Request, Response, NextFunction } from 'express';
import * as inventoryService from './inventory.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function listInventoryItems(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await inventoryService.listInventoryItems(req.query as any);
    return sendSuccess(res, result.items, { pagination: result.pagination });
  } catch (error) {
    next(error);
  }
}

export async function getItemById(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await inventoryService.getItemById(Number(req.params.id));
    return sendSuccess(res, item);
  } catch (error) {
    next(error);
  }
}

export async function createItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await inventoryService.createItem(req.body, req.user!.id);
    return sendSuccess(res, item, { statusCode: 201, message: 'Inventory item created successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updateItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await inventoryService.updateItem(Number(req.params.id), req.body);
    return sendSuccess(res, item, { message: 'Inventory item updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function adjustStock(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await inventoryService.adjustStock(
      Number(req.params.id),
      req.body,
      req.user!.id
    );

    return sendSuccess(res, result, {
      message: `Stock adjusted successfully for item. Quantity changed by ${req.body.quantity_change}.`,
      warning: result.override_applied
        ? 'Stock quantity is now negative due to explicit override.'
        : undefined,
    });
  } catch (error) {
    next(error);
  }
}

export async function getItemTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await inventoryService.getItemTransactions(
      Number(req.params.id),
      req.query as any
    );
    return sendSuccess(res, result.transactions, { pagination: result.pagination });
  } catch (error) {
    next(error);
  }
}

export async function deleteItem(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await inventoryService.deleteItem(Number(req.params.id));
    return sendSuccess(res, result, { message: 'Inventory item deleted successfully' });
  } catch (error) {
    next(error);
  }
}
