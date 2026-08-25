import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';
import { sendError } from '../utils/response.js';

export function validateBody(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return sendError(
          res,
          400,
          'Validation failed',
          'VALIDATION_ERROR',
          error.issues.map((e: ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        );
      }
      next(error);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = (await schema.parseAsync(req.query)) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return sendError(
          res,
          400,
          'Query validation failed',
          'VALIDATION_ERROR',
          error.issues.map((e: ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        );
      }
      next(error);
    }
  };
}

export function validateParams(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = (await schema.parseAsync(req.params)) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return sendError(
          res,
          400,
          'URL parameters validation failed',
          'VALIDATION_ERROR',
          error.issues.map((e: ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        );
      }
      next(error);
    }
  };
}
