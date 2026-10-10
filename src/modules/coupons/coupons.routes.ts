import { Router } from 'express';
import { authenticateAdmin, authenticateCustomer, requirePermission } from '../../middleware/auth';
import { CouponsController } from './coupons.controller';

const router = Router();

router.post('/apply', authenticateCustomer({ optional: true }), CouponsController.applyCoupon);
router.get('/admin', authenticateAdmin, requirePermission('coupons:manage'), CouponsController.adminGetCoupons);
router.post('/admin', authenticateAdmin, requirePermission('coupons:manage'), CouponsController.adminCreateCoupon);
router.patch('/admin/:id/toggle', authenticateAdmin, requirePermission('coupons:manage'), CouponsController.adminToggleCoupon);

export default router;

