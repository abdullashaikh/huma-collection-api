import { Router } from 'express';
import { authenticateAdmin, requirePermission } from '../../middleware/auth';
import { SettingsController } from './settings.controller';

const router = Router();

// Public routes
router.get('/', SettingsController.getSettings);
router.get('/banners', SettingsController.getBanners);

// Admin routes
router.put('/admin', authenticateAdmin, requirePermission('settings:manage'), SettingsController.adminUpdateSettings);
router.get('/admin/banners', authenticateAdmin, requirePermission('banners:manage'), SettingsController.adminGetBanners);

export default router;
