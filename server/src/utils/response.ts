import { Response } from 'express';

export interface ApiResponseOptions<T = any> {
  statusCode?: number;
  message?: string;
  warning?: string;
  duplicates?: any[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function sendSuccess<T>(res: Response, data: T, options: ApiResponseOptions<T> = {}) {
  const { statusCode = 200, message, warning, duplicates, pagination } = options;

  const responseBody: Record<string, any> = {
    success: true,
    data,
  };

  if (message) responseBody.message = message;
  if (warning) responseBody.warning = warning;
  if (duplicates) responseBody.duplicates = duplicates;
  if (pagination) responseBody.pagination = pagination;

  return res.status(statusCode).json(responseBody);
}

export function sendError(
  res: Response,
  statusCode = 400,
  message = 'An error occurred',
  code = 'ERROR',
  details?: any
) {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      details,
    },
  });
}
