import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess } from '../../utils/response';
import { MediaService } from './media.service';

const presignRequestSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(3),
  fileSize: z.number().int().positive(),
  folder: z.enum(['products', 'banners', 'videos']).default('products'),
});

export class MediaController {
  static async getPresignedUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { fileName, mimeType, fileSize, folder } = presignRequestSchema.parse(req.body);
    const result = await MediaService.getPresignedUploadUrl(fileName, mimeType, fileSize, folder);
    sendSuccess(res, result, 'Presigned S3 upload authorization granted');
  }
}
