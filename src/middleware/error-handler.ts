import { NextFunction, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';
import { sendError } from '../utils/response';

export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;
  public details?: any;

  constructor(message: string, statusCode: number = 400, errorCode: string = 'APP_ERROR', details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: any,
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.id || 'unknown';

  // Log error
  logger.error('Unhandled or Application Error:', {
    requestId,
    name: err.name,
    message: err.message,
    statusCode: err.statusCode,
    stack: env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  // 1. Zod Validation Error
  if (err instanceof ZodError) {
    const formattedDetails = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      rule: issue.code,
    }));
    sendError(res, 'Request validation failed', 422, 'VALIDATION_ERROR', formattedDetails);
    return;
  }

  // 2. Custom AppError
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.errorCode, err.details);
    return;
  }

  // 3. JWT Authentication Errors
  if (err.name === 'TokenExpiredError') {
    sendError(res, 'Session token has expired. Please authenticate again.', 401, 'TOKEN_EXPIRED');
    return;
  }
  if (err.name === 'JsonWebTokenError') {
    sendError(res, 'Invalid authentication token provided.', 401, 'TOKEN_INVALID');
    return;
  }

  // 4. MySQL Database Errors
  if (err.code === 'ER_DUP_ENTRY') {
    sendError(res, 'A record with these unique details already exists.', 409, 'DUPLICATE_ENTRY');
    return;
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    sendError(res, 'Referenced record was not found.', 400, 'FOREIGN_KEY_VIOLATION');
    return;
  }

  // 5. Default 500 Internal Server Error
  const clientMessage =
    env.NODE_ENV === 'production'
      ? 'An unexpected internal error occurred. Please try again later.'
      : err.message || 'Internal Server Error';

  sendError(res, clientMessage, 500, 'INTERNAL_SERVER_ERROR');
}
