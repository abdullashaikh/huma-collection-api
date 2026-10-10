import bcrypt from 'bcryptjs';
import { query } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/error-handler';
import {
  signAdminAccessToken,
  signAdminRefreshToken,
  signCustomerAccessToken,
  signCustomerRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt';

export class AuthService {
  /**
   * Generates a 6-digit OTP for customer phone authentication.
   */
  static async sendCustomerOtp(phone: string): Promise<{ message: string; devOtp?: string }> {
    // Clean phone number (Indian 10-digit or +91 standard)
    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (!/^\+?[0-9]{10,13}$/.test(cleanPhone)) {
      throw new AppError('Invalid mobile phone number format', 422, 'INVALID_PHONE');
    }

    // In production, integrate SMS gateway (e.g. Twilio / Fast2SMS).
    // For local dev / staging, generate realistic 6-digit code.
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate previous unused OTPs for this phone
    await query('UPDATE customer_otps SET is_used = 1 WHERE phone = ? AND is_used = 0', [cleanPhone]);

    // Store new OTP
    await query(
      `INSERT INTO customer_otps (phone, otp_code, expires_at)
       VALUES (?, ?, ?)`,
      [cleanPhone, otpCode, expiresAt]
    );

    logger.info(`Generated OTP for ${cleanPhone}: ${otpCode}`);

    return {
      message: `OTP sent successfully to ${cleanPhone}`,
      devOtp: env.NODE_ENV !== 'production' ? otpCode : undefined,
    };
  }

  /**
   * Verifies OTP and returns customer tokens.
   */
  static async verifyCustomerOtp(
    phone: string,
    otpCode: string,
    fullName?: string
  ): Promise<{
    user: any;
    accessToken: string;
    refreshToken: string;
  }> {
    const cleanPhone = phone.replace(/[\s-]/g, '');

    const isDevBypass = env.NODE_ENV !== 'production' && otpCode === '123456';

    const records: any = await query(
      `SELECT * FROM customer_otps
       WHERE phone = ? AND (otp_code = ? OR ?) AND is_used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [cleanPhone, otpCode, isDevBypass ? 1 : 0]
    );

    if (!records.length && !isDevBypass) {
      throw new AppError('Invalid or expired OTP code', 400, 'INVALID_OTP');
    }

    // Mark OTP used
    if (records.length) {
      await query('UPDATE customer_otps SET is_used = 1 WHERE id = ?', [records[0].id]);
    }


    // Fetch or create customer user
    let users: any = await query('SELECT * FROM users WHERE phone = ?', [cleanPhone]);
    let userId: number;

    if (!users.length) {
      let firstName = 'Valued';
      let lastName = 'Customer';
      if (fullName) {
        const parts = fullName.trim().split(' ');
        firstName = parts[0];
        lastName = parts.slice(1).join(' ') || '';
      }

      const insertRes: any = await query(
        `INSERT INTO users (phone, first_name, last_name, is_verified, is_active, last_login_at)
         VALUES (?, ?, ?, 1, 1, NOW())`,
        [cleanPhone, firstName, lastName]
      );
      userId = insertRes.insertId;
      users = await query('SELECT * FROM users WHERE id = ?', [userId]);
    } else {
      userId = users[0].id;
      await query('UPDATE users SET last_login_at = NOW(), is_verified = 1 WHERE id = ?', [userId]);
    }

    const payload = {
      userId,
      phone: cleanPhone,
      isVerified: true,
    };

    const accessToken = signCustomerAccessToken(payload);
    const refreshToken = signCustomerRefreshToken(payload);

    return {
      user: {
        id: users[0].id,
        phone: users[0].phone,
        firstName: users[0].first_name,
        lastName: users[0].last_name,
        email: users[0].email,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Admin credentials authentication with RBAC and Audit logging.
   */
  static async loginAdmin(
    email: string,
    passwordPlain: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{
    admin: any;
    accessToken: string;
    refreshToken: string;
  }> {
    const cleanEmail = email.toLowerCase().trim();

    const admins: any = await query(
      `SELECT a.id, a.email, a.password_hash, a.first_name, a.last_name, a.is_active,
              r.id AS role_id, r.name AS role_name
       FROM admin_users a
       JOIN roles r ON a.role_id = r.id
       WHERE a.email = ?`,
      [cleanEmail]
    );

    if (!admins.length) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const admin = admins[0];

    if (!admin.is_active) {
      throw new AppError('This administrative account has been deactivated.', 403, 'ACCOUNT_DEACTIVATED');
    }

    const isMatch = await bcrypt.compare(passwordPlain, admin.password_hash);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Fetch permissions
    const perms: any = await query(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?`,
      [admin.role_id]
    );
    const permissions = perms.map((p: any) => p.code);

    // Record login timestamp
    await query('UPDATE admin_users SET last_login_at = NOW() WHERE id = ?', [admin.id]);

    // Record audit log
    await query(
      `INSERT INTO admin_audit_logs (admin_id, action, resource_type, resource_id, ip_address, user_agent)
       VALUES (?, 'LOGIN', 'ADMIN_AUTH', ?, ?, ?)`,
      [admin.id, admin.id.toString(), ipAddress, userAgent]
    );

    const payload = {
      adminId: admin.id,
      email: admin.email,
      roleId: admin.role_id,
      roleName: admin.role_name,
      permissions,
    };

    const accessToken = signAdminAccessToken(payload);
    const refreshToken = signAdminRefreshToken(payload);

    return {
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.first_name,
        lastName: admin.last_name,
        role: admin.role_name,
        permissions,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh admin access token using a valid refresh token.
   */
  static async refreshAdminToken(token: string): Promise<{ accessToken: string }> {
    const decoded = verifyRefreshToken<any>(token);
    if (!decoded.adminId) {
      throw new AppError('Invalid refresh token type', 401, 'INVALID_TOKEN');
    }

    const admins: any = await query(
      `SELECT a.id, a.email, a.is_active, r.id AS role_id, r.name AS role_name
       FROM admin_users a
       JOIN roles r ON a.role_id = r.id
       WHERE a.id = ?`,
      [decoded.adminId]
    );

    if (!admins.length || !admins[0].is_active) {
      throw new AppError('Admin account not found or inactive', 401, 'UNAUTHORIZED');
    }

    const perms: any = await query(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?`,
      [admins[0].role_id]
    );

    const payload = {
      adminId: admins[0].id,
      email: admins[0].email,
      roleId: admins[0].role_id,
      roleName: admins[0].role_name,
      permissions: perms.map((p: any) => p.code),
    };

    return { accessToken: signAdminAccessToken(payload) };
  }
}
