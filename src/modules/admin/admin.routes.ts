import { Router } from 'express';
import { authenticateAdmin, requirePermission } from '../../middleware/auth';
import { AdminDashboardController } from './admin.controller';

const router = Router();

router.get('/dashboard/stats', authenticateAdmin, AdminDashboardController.getDashboardStats);
router.get('/audit-logs', authenticateAdmin, requirePermission('audit:read'), AdminDashboardController.getAuditLogs);
router.get('/inventory', authenticateAdmin, requirePermission('inventory:read'), AdminDashboardController.getInventory);
router.post('/inventory/adjust', authenticateAdmin, requirePermission('inventory:adjust'), AdminDashboardController.adjustInventory);
router.get('/inventory/transactions', authenticateAdmin, requirePermission('inventory:read'), AdminDashboardController.getInventoryTransactions);

export default router;

