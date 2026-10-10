import { NextFunction, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../types';

export function requestIdMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'] as string;
  const requestId = incomingId || `req_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
