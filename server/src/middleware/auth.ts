import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthUser } from '../types/express.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import pool from '../db/pool.js';

const JWT_SECRET = process.env.JWT_SECRET || 'atri-management-secret-key-fallback';

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Authentication token not provided');
    }

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Token has expired. Please login again');
      }
      throw new UnauthorizedError('Invalid authentication token');
    }

    if (!payload || !payload.id) {
      throw new UnauthorizedError('Malformed token payload');
    }

    // Verify user exists and is active
    const userResult = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [payload.id]
    );

    if (userResult.rows.length === 0) {
      throw new UnauthorizedError('User associated with this token no longer exists');
    }

    const user = userResult.rows[0];
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(allowedRoles: ('admin' | 'manager' | 'employee')[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Action restricted. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}`
        )
      );
    }

    next();
  };
}

/**
 * Business Rule:
 * Employees should NOT be able to delete financial or inventory records.
 * Blocks DELETE requests on inventory/financial entities for the 'employee' role.
 */
export function restrictEmployeeDelete(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (req.user.role === 'employee' && req.method === 'DELETE') {
    return next(
      new ForbiddenError(
        'Employees are not permitted to delete inventory or financial records. Void or reversal adjustments should be created instead.'
      )
    );
  }

  next();
}
