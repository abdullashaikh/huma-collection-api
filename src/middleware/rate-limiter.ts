import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/response';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 'Too many requests from this IP. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit login / OTP attempts to 15 per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(
      res,
      'Too many authentication attempts. Please wait 15 minutes before retrying.',
      429,
      'AUTH_RATE_LIMIT_EXCEEDED'
    );
  },
});

export const checkoutLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 checkout attempts per 5 mins
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 'Too many order requests. Please wait a moment.', 429, 'CHECKOUT_RATE_LIMIT_EXCEEDED');
  },
});
