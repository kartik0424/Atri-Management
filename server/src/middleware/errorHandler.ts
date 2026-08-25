import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // 1. Custom Application Error
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.message, err.code, err.details);
  }

  // 2. PostgreSQL Specific Errors
  if (err.code) {
    switch (err.code) {
      case '23505': // unique_violation
        return sendError(
          res,
          409,
          'A record with matching unique fields already exists',
          'DUPLICATE_RESOURCE',
          { detail: err.detail }
        );
      case '23503': // foreign_key_violation
        return sendError(
          res,
          400,
          'Referenced record does not exist or cannot be modified/deleted due to existing relationships',
          'FOREIGN_KEY_VIOLATION',
          { detail: err.detail }
        );
      case '23514': // check_violation
        return sendError(
          res,
          400,
          'Data violates database integrity check constraint',
          'CHECK_CONSTRAINT_VIOLATION',
          { detail: err.detail }
        );
      case '22P02': // invalid_text_representation (e.g. invalid integer id in URL)
        return sendError(
          res,
          400,
          'Invalid parameter format or data type',
          'INVALID_DATA_TYPE',
          { detail: err.message }
        );
    }
  }

  // 3. Fallback Internal Server Error
  console.error('Unhandled API Error:', err);
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  return sendError(res, 500, message, 'INTERNAL_SERVER_ERROR');
}

export function notFoundHandler(req: Request, res: Response) {
  return sendError(
    res,
    404,
    `Route ${req.method} ${req.originalUrl} not found`,
    'ROUTE_NOT_FOUND'
  );
}
