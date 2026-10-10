import { Router } from 'express';
import { authenticateAdmin, authenticateCustomer, requirePermission } from '../../middleware/auth';
import { checkoutLimiter } from '../../middleware/rate-limiter';
import { OrdersController } from './orders.controller';

const router = Router();

// Customer Order creation (Rate limited, guest or authenticated)
router.post('/', checkoutLimiter, authenticateCustomer({ optional: true }), OrdersController.createOrder);

// Customer Order tracking
router.get('/track/:orderNumber', OrdersController.trackOrder);

// Admin Order management
router.get('/admin', authenticateAdmin, requirePermission('orders:read'), OrdersController.adminGetOrders);
router.patch('/admin/:id/status', authenticateAdmin, requirePermission('orders:update'), OrdersController.adminUpdateStatus);

export default router;
