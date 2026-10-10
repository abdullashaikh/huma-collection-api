import { Response } from 'express';
import { ApiResponse, AuthenticatedRequest } from '../types';

export function sendSuccess<T>(
  res: Response,
  data?: T,
  message: string = 'Success',
  statusCode: number = 200,
  meta?: ApiResponse['meta']
): void {
  const req = res.req as AuthenticatedRequest;
  const payload: ApiResponse<T> = {
    success: true,
    statusCode,
    message,
    data,
    meta,
    requestId: req.id,
  };
  res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  message: string,
  statusCode: number = 400,
  errorCode: string = 'BAD_REQUEST',
  details?: any
): void {
  const req = res.req as AuthenticatedRequest;
  const payload: ApiResponse = {
    success: false,
    statusCode,
    message,
    error: {
      code: errorCode,
      message,
      details,
    },
    requestId: req.id,
  };
  res.status(statusCode).json(payload);
}
