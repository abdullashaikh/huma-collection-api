import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AdminAuthPayload, CustomerAuthPayload } from '../types';

export function signCustomerAccessToken(payload: CustomerAuthPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  } as jwt.SignOptions);
}

export function signCustomerRefreshToken(payload: CustomerAuthPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  } as jwt.SignOptions);
}

export function signAdminAccessToken(payload: AdminAuthPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  } as jwt.SignOptions);
}

export function signAdminRefreshToken(payload: AdminAuthPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  } as jwt.SignOptions);
}

export function verifyAccessToken<T = any>(token: string): T {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as T;
}

export function verifyRefreshToken<T = any>(token: string): T {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as T;
}
