import { Router } from 'express';
import { authenticateAdmin, requirePermission } from '../../middleware/auth';
import { MediaController } from './media.controller';

const router = Router();

// Only authenticated admins with media:upload permission can request upload tickets
router.post(
  '/presign-upload',
  authenticateAdmin,
  requirePermission('media:upload'),
  MediaController.getPresignedUrl
);

export default router;
