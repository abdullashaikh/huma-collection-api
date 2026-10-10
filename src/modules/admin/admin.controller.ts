import { Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess } from '../../utils/response';
import { AdminDashboardService } from './admin.service';

export class AdminDashboardController {
  static async getDashboardStats(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const stats = await AdminDashboardService.getStats();
    sendSuccess(res, stats, 'Dashboard statistics retrieved');
  }

  static async getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const { logs, meta } = await AdminDashboardService.getAuditLogs(page, limit);
    sendSuccess(res, logs, 'Audit logs retrieved', 200, meta);
  }

  static async getInventory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { inventory, total } = await AdminDashboardService.getInventory(req.query);
    sendSuccess(res, inventory, 'Inventory retrieved successfully', 200, {
      total,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
  }

  static async adjustInventory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const adminId = req.admin?.adminId || 1;
    const result = await AdminDashboardService.adjustInventory(adminId, req.body);
    sendSuccess(res, result, 'Inventory adjusted successfully');
  }

  static async getInventoryTransactions(req: AuthenticatedRequest, res: Response): Promise<void> {
    const limit = Number(req.query.limit) || 20;
    const transactions = await AdminDashboardService.getInventoryTransactions(limit);
    sendSuccess(res, transactions, 'Inventory transactions retrieved');
  }
}

