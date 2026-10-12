import { Router } from 'express';
import multer from 'multer';
import { authenticateAdmin, requirePermission } from '../../middleware/auth';
import { MediaController } from './media.controller';

const router = Router();

// In-memory multer storage for streaming directly to AWS S3 or fallback disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB per file (will be compressed to ~150-250KB WebP)
    files: 10,
  },
});

// 1. Direct Single File Upload (e.g. category image, single product image)
router.post(
  '/upload',
  authenticateAdmin,
  requirePermission('media:upload'),
  upload.single('file'),
  MediaController.uploadSingle
);

// 2. Direct Multiple Files Upload (e.g. batch product gallery, front + back + 360 views)
router.post(
  '/upload-multiple',
  authenticateAdmin,
  requirePermission('media:upload'),
  upload.array('files', 10),
  MediaController.uploadMultiple
);

// 3. Presigned Direct-to-S3 Upload Authorization
router.post(
  '/presign-upload',
  authenticateAdmin,
  requirePermission('media:upload'),
  MediaController.getPresignedUrl
);

// 4. Public streaming proxy for S3 media assets
router.get('/file/*', MediaController.streamFile);

export default router;
