import { Request, Response, NextFunction } from 'express';
import * as orderService from './orders.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function listOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await orderService.listOrders(req.query as any);
    return sendSuccess(res, result.orders, { pagination: result.pagination });
  } catch (error) {
    next(error);
  }
}

export async function getOrderById(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await orderService.getOrderById(Number(req.params.id));
    return sendSuccess(res, order);
  } catch (error) {
    next(error);
  }
}

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await orderService.createOrder(req.body, req.user!.id);
    return sendSuccess(res, order, {
      statusCode: 201,
      message: `Order ${order.order_number} created successfully with status "received". Inventory has not been modified.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await orderService.updateOrder(Number(req.params.id), req.body, req.user!.id);
    return sendSuccess(res, order, { message: 'Order updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function duplicateOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const newOrder = await orderService.duplicateOrder(Number(req.params.id), req.user!.id);
    return sendSuccess(res, newOrder, {
      statusCode: 201,
      message: `Repeat order created successfully as ${newOrder.order_number}. Original order was unchanged.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function getOrderMaterialRequirements(req: Request, res: Response, next: NextFunction) {
  try {
    const requirements = await orderService.getOrderMaterialRequirements(Number(req.params.id));
    return sendSuccess(res, requirements);
  } catch (error) {
    next(error);
  }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await orderService.updateOrderStatus(Number(req.params.id), req.body, req.user!.id);
    const isProduction = req.body.status === 'production';
    return sendSuccess(res, order, {
      message: isProduction
        ? `Order status updated to "production". Raw materials consumed from inventory.`
        : `Order status updated to "${req.body.status}".`,
      warning: req.body.force ? 'Production was forced with insufficient stock override.' : undefined,
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await orderService.cancelOrder(Number(req.params.id), req.body.notes || null, req.user!.id);
    return sendSuccess(res, order, {
      message: 'Order cancelled successfully.',
      warning: order.can_restore_inventory
        ? 'Inventory was previously consumed for this order. You can call /restore-inventory to return stock.'
        : undefined,
    });
  } catch (error) {
    next(error);
  }
}

export async function restoreOrderInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await orderService.restoreOrderInventory(Number(req.params.id), req.user!.id);
    return sendSuccess(res, result, {
      message: `Successfully restored ${result.restored_items_count} material(s) back to inventory via offsetting audit records.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function getOrderProfitability(req: Request, res: Response, next: NextFunction) {
  try {
    const profitability = await orderService.getOrderProfitability(Number(req.params.id));
    return sendSuccess(res, profitability);
  } catch (error) {
    next(error);
  }
}
