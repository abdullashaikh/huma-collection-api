import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rate-limiter';
import { AuthController } from './auth.controller';

const router = Router();

// Customer endpoints
router.post('/customer/otp/send', authLimiter, AuthController.sendOtp);
router.post('/customer/otp/verify', authLimiter, AuthController.verifyOtp);

// Admin endpoints
router.post('/admin/login', authLimiter, AuthController.adminLogin);
router.post('/admin/logout', AuthController.adminLogout);
router.get('/admin/me', authenticateAdmin, AuthController.getAdminProfile);

export default router;
