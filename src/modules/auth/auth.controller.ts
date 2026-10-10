import { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess } from '../../utils/response';
import { AuthService } from './auth.service';

const sendOtpSchema = z.object({
  phone: z.string().min(10, 'Valid 10-digit phone number is required'),
});

const verifyOtpSchema = z.object({
  phone: z.string().min(10, 'Valid 10-digit phone number is required'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  fullName: z.string().optional(),
});

const adminLoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export class AuthController {
  static async sendOtp(req: Request, res: Response): Promise<void> {
    const { phone } = sendOtpSchema.parse(req.body);
    const result = await AuthService.sendCustomerOtp(phone);
    sendSuccess(res, result, result.message);
  }

  static async verifyOtp(req: Request, res: Response): Promise<void> {
    const { phone, otp, fullName } = verifyOtpSchema.parse(req.body);
    const result = await AuthService.verifyCustomerOtp(phone, otp, fullName);

    // Set secure HttpOnly refresh token cookie
    res.cookie('customer_refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendSuccess(res, result, 'Verification successful. Welcome to Huma Hijab Collection!');
  }

  static async adminLogin(req: Request, res: Response): Promise<void> {
    const { email, password } = adminLoginSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const result = await AuthService.loginAdmin(email, password, ip, userAgent);

    // Set HttpOnly cookies for admin security
    res.cookie('admin_access_token', result.accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    res.cookie('admin_refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendSuccess(res, result, 'Admin authenticated successfully');
  }

  static async adminLogout(_req: Request, res: Response): Promise<void> {
    res.clearCookie('admin_access_token');
    res.clearCookie('admin_refresh_token');
    sendSuccess(res, null, 'Logged out successfully');
  }

  static async getAdminProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    sendSuccess(res, req.admin, 'Profile retrieved');
  }
}
