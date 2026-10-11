import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess } from '../../utils/response';
import { MediaService } from './media.service';
import { AppError } from '../../middleware/error-handler';

const presignRequestSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(3),
  fileSize: z.number().int().positive(),
  folder: z.enum(['products', 'categories', 'banners', 'videos']).default('products'),
});

export class MediaController {
  static async getPresignedUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { fileName, mimeType, fileSize, folder } = presignRequestSchema.parse(req.body);
    const result = await MediaService.getPresignedUploadUrl(fileName, mimeType, fileSize, folder);
    sendSuccess(res, result, 'Presigned S3 upload authorization granted');
  }

  static async uploadSingle(req: AuthenticatedRequest, res: Response): Promise<void> {
    const file = req.file;
    if (!file) {
      throw new AppError('No file attached in request under field "file"', 400, 'NO_FILE_PROVIDED');
    }
    const folder = (req.body?.folder as any) || 'products';
    const result = await MediaService.uploadDirectFile(file, folder);
    sendSuccess(res, result, 'Media file successfully uploaded and ready for catalogue use');
  }

  static async uploadMultiple(req: AuthenticatedRequest, res: Response): Promise<void> {
    const files = req.files as Express.Multer.File[];
    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new AppError('No files attached in request under field "files"', 400, 'NO_FILES_PROVIDED');
    }
    const folder = (req.body?.folder as any) || 'products';
    const results = await MediaService.uploadMultipleFiles(files, folder);
    sendSuccess(res, results, `${results.length} media files successfully uploaded`);
  }

  static async streamFile(req: any, res: Response): Promise<void> {
    let s3Key = req.params[0] || req.params.key;
    if (!s3Key) {
      res.status(400).send('Missing S3 key');
      return;
    }
    // Clean key: strip leading slashes, query parameters, or bucket name prefix
    s3Key = s3Key.replace(/^\/+/, '').replace(/^(huma-collection-products-2026\/)/, '').split('?')[0];
    try {
      const obj = await MediaService.getFileStream(s3Key);
      if (obj.ContentType) res.setHeader('Content-Type', obj.ContentType);
      if (obj.ContentLength) res.setHeader('Content-Length', obj.ContentLength);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
      (obj.Body as any).pipe(res);
    } catch (err: any) {
      res.status(404).send('File not found in S3');
    }
  }
}
