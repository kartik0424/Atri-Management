import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body);
    return sendSuccess(res, result, { message: 'Logged in successfully' });
  } catch (error) {
    next(error);
  }
}

export async function logout(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, { loggedOut: true }, { message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getCurrentUser(req.user!.id);
    return sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
}
