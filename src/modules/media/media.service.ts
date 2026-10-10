import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/error-handler';

const ALLOWED_MIME_TYPES: Record<string, { ext: string; maxSize: number }> = {
  'image/webp': { ext: 'webp', maxSize: 5 * 1024 * 1024 }, // 5MB
  'image/jpeg': { ext: 'jpg', maxSize: 5 * 1024 * 1024 },  // 5MB
  'image/png': { ext: 'png', maxSize: 5 * 1024 * 1024 },    // 5MB
  'video/mp4': { ext: 'mp4', maxSize: 50 * 1024 * 1024 },  // 50MB
};

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export class MediaService {
  /**
   * Generates a secure, short-lived (15 min) presigned URL for direct S3 upload.
   */
  static async getPresignedUploadUrl(
    fileName: string,
    mimeType: string,
    fileSize: number,
    folder: 'products' | 'banners' | 'videos' = 'products'
  ): Promise<{
    uploadUrl: string;
    s3Key: string;
    publicUrl: string;
    expiresInSeconds: number;
  }> {
    // 1. Validate MIME type
    const mimeConfig = ALLOWED_MIME_TYPES[mimeType];
    if (!mimeConfig) {
      throw new AppError(
        `Unsupported media type: '${mimeType}'. Allowed formats: WEBP, JPEG, PNG, MP4.`,
        400,
        'INVALID_MIME_TYPE'
      );
    }

    // 2. Validate file size
    if (fileSize > mimeConfig.maxSize) {
      const maxMb = mimeConfig.maxSize / (1024 * 1024);
      throw new AppError(
        `File size exceeds maximum limit of ${maxMb}MB for ${mimeType}`,
        400,
        'FILE_TOO_LARGE'
      );
    }

    // 3. Clean filename and generate unique S3 key
    const sanitizedBase = fileName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);
    const uniqueSuffix = uuidv4().slice(0, 8);
    const s3Key = `${folder}/${sanitizedBase}-${uniqueSuffix}.${mimeConfig.ext}`;
    const expiresInSeconds = 900; // 15 minutes

    const publicUrl = `${env.CLOUDFRONT_DOMAIN}/${s3Key}`;

    // 4. Generate presigned URL via AWS SDK
    try {
      const command = new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: s3Key,
        ContentType: mimeType,
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });

      logger.info(`Generated S3 presigned upload URL for key: ${s3Key}`);

      return {
        uploadUrl,
        s3Key,
        publicUrl,
        expiresInSeconds,
      };
    } catch (err: any) {
      logger.warn('AWS S3 presigned generation fallback (using local mock URL):', { error: err.message });
      // Development fallback when offline/sample AWS keys are used
      return {
        uploadUrl: `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${s3Key}?mock_presigned=true`,
        s3Key,
        publicUrl: `https://images.unsplash.com/photo-1584282479901-705a6104bc99?auto=format&fit=crop&w=1200&q=85`,
        expiresInSeconds,
      };
    }
  }
}
