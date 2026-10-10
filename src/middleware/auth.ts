import { NextFunction, Response } from 'express';
import { query } from '../config/database';
import { AdminAuthPayload, AuthenticatedRequest, CustomerAuthPayload } from '../types';
import { verifyAccessToken } from '../utils/jwt';
import { sendError } from '../utils/response';

/**
 * Verifies customer JWT from Bearer token or HttpOnly cookie.
 * If optional = true, allows request to proceed as guest if no token provided.
 */
export function authenticateCustomer(options: { optional?: boolean } = {}) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const cookieToken = req.cookies?.customer_access_token;

      let token: string | undefined;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      } else if (cookieToken) {
        token = cookieToken;
      }

      if (!token) {
        if (options.optional) {
          return next();
        }
        sendError(res, 'Authentication required. Please sign in.', 401, 'UNAUTHORIZED');
        return;
      }

      const decoded = verifyAccessToken<CustomerAuthPayload>(token);

      // Verify user still exists & is active
      const users: any = await query('SELECT id, phone, is_active FROM users WHERE id = ?', [decoded.userId]);
      if (!users.length || !users[0].is_active) {
        sendError(res, 'Customer account is inactive or not found.', 401, 'ACCOUNT_INACTIVE');
        return;
      }

      req.customer = decoded;
      next();
    } catch (err: any) {
      if (options.optional) {
        return next();
      }
      sendError(res, 'Invalid or expired session token.', 401, 'TOKEN_INVALID');
    }
  };
}

/**
 * Strict authentication for Admin personnel.
 */
export async function authenticateAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.admin_access_token;

    let token: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (cookieToken) {
      token = cookieToken;
    }

    if (!token) {
      sendError(res, 'Administrative authentication required.', 401, 'ADMIN_UNAUTHORIZED');
      return;
    }

    const decoded = verifyAccessToken<AdminAuthPayload>(token);

    // Verify active status and fetch latest permissions
    const admins: any = await query(
      `SELECT a.id, a.email, a.is_active, r.id AS role_id, r.name AS role_name
       FROM admin_users a
       JOIN roles r ON a.role_id = r.id
       WHERE a.id = ?`,
      [decoded.adminId]
    );

    if (!admins.length || !admins[0].is_active) {
      sendError(res, 'Admin account has been deactivated or not found.', 401, 'ADMIN_INACTIVE');
      return;
    }

    // Refresh permissions from DB
    const perms: any = await query(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?`,
      [admins[0].role_id]
    );

    req.admin = {
      adminId: admins[0].id,
      email: admins[0].email,
      roleId: admins[0].role_id,
      roleName: admins[0].role_name,
      permissions: perms.map((p: any) => p.code),
    };

    next();
  } catch (err: any) {
    sendError(res, 'Invalid administrative token.', 401, 'ADMIN_TOKEN_INVALID');
  }
}

/**
 * Role-Based Access Control permission gate.
 */
export function requirePermission(permissionCode: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      sendError(res, 'Admin authentication required.', 401, 'UNAUTHORIZED');
      return;
    }

    if (req.admin.roleName === 'SUPER_ADMIN') {
      return next();
    }

    if (!req.admin.permissions.includes(permissionCode)) {
      sendError(
        res,
        `Forbidden: Missing required administrative permission '${permissionCode}'`,
        403,
        'FORBIDDEN'
      );
      return;
    }

    next();
  };
}
