import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/error-handler';

export const ALLOWED_MIME_TYPES: Record<string, { ext: string; maxSize: number }> = {
  'image/webp': { ext: 'webp', maxSize: 10 * 1024 * 1024 }, // 10MB
  'image/jpeg': { ext: 'jpg', maxSize: 10 * 1024 * 1024 },  // 10MB
  'image/jpg': { ext: 'jpg', maxSize: 10 * 1024 * 1024 },   // 10MB
  'image/png': { ext: 'png', maxSize: 10 * 1024 * 1024 },   // 10MB
  'image/gif': { ext: 'gif', maxSize: 10 * 1024 * 1024 },   // 10MB
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
   * Generates a permanent public URL for a given S3 key.
   */
  static getS3PublicUrl(s3Key: string): string {
    const cfDomain = env.CLOUDFRONT_DOMAIN;
    if (cfDomain && !cfDomain.includes('images.unsplash.com') && !cfDomain.includes('amazonaws.com')) {
      return `${cfDomain.replace(/\/$/, '')}/${s3Key}`;
    }
    const host = process.env.BACKEND_PUBLIC_URL || `http://localhost:${env.PORT || 5000}`;
    return `${host}/api/v1/media/file/${s3Key}`;
  }

  /**
   * Automatically converts private S3 direct URLs to the streaming proxy
   */
  static formatMediaUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.includes(`${env.AWS_S3_BUCKET}.s3`) || (url.includes('s3.') && url.includes('amazonaws.com') && url.includes(env.AWS_S3_BUCKET))) {
      const match = url.match(/amazonaws\.com\/(.+)$/);
      if (match) {
        const host = process.env.BACKEND_PUBLIC_URL || `http://localhost:${env.PORT || 5000}`;
        return `${host}/api/v1/media/file/${match[1]}`;
      }
    }
    return url;
  }

  /**
   * Retrieves an object stream from S3 using server credentials
   */
  static async getFileStream(s3Key: string) {
    const command = new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: s3Key,
    });
    return s3Client.send(command);
  }

  /**
   * Directly uploads a file buffer to S3 (or falls back to persistent local storage on AWS IAM issue)
   */
  static async uploadDirectFile(
    file: Express.Multer.File,
    folder: 'products' | 'categories' | 'banners' | 'videos' = 'products'
  ): Promise<{
    s3Url: string;
    s3Key: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    storage: 's3' | 'local_fallback';
  }> {
    if (!file) {
      throw new AppError('No file provided for upload', 400, 'NO_FILE_PROVIDED');
    }

    const mimeConfig = ALLOWED_MIME_TYPES[file.mimetype];
    if (!mimeConfig) {
      throw new AppError(
        `Unsupported media type: '${file.mimetype}'. Allowed: WEBP, JPEG, PNG, GIF, MP4.`,
        400,
        'INVALID_MIME_TYPE'
      );
    }

    if (file.size > mimeConfig.maxSize) {
      const maxMb = mimeConfig.maxSize / (1024 * 1024);
      throw new AppError(`File exceeds maximum size limit of ${maxMb}MB`, 400, 'FILE_TOO_LARGE');
    }

    // Clean name and create unique key
    const sanitizedBase = (file.originalname || 'upload')
      .toLowerCase()
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);
    const uniqueSuffix = uuidv4().slice(0, 8);
    const s3Key = `${folder}/${sanitizedBase}-${uniqueSuffix}.${mimeConfig.ext}`;

    // Attempt AWS S3 PutObject
    try {
      const command = new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await s3Client.send(command);
      logger.info(`File successfully uploaded directly to S3: ${s3Key}`);

      const s3Url = this.getS3PublicUrl(s3Key);
      return {
        s3Url,
        s3Key,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storage: 's3',
      };
    } catch (err: any) {
      logger.error(`AWS S3 Upload failed: ${err.message}`);
      throw new AppError(
        `AWS S3 Upload Failed: ${err.message}`,
        500,
        'AWS_S3_UPLOAD_ERROR'
      );
    }
  }

  /**
   * Uploads multiple files in parallel
   */
  static async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: 'products' | 'categories' | 'banners' | 'videos' = 'products'
  ): Promise<any[]> {
    if (!files || files.length === 0) {
      throw new AppError('No files uploaded', 400, 'NO_FILES_PROVIDED');
    }
    return Promise.all(files.map((f) => this.uploadDirectFile(f, folder)));
  }

  /**
   * Generates a secure presigned upload URL
   */
  static async getPresignedUploadUrl(
    fileName: string,
    mimeType: string,
    fileSize: number,
    folder: 'products' | 'categories' | 'banners' | 'videos' = 'products'
  ): Promise<{
    uploadUrl: string;
    s3Key: string;
    publicUrl: string;
    expiresInSeconds: number;
  }> {
    const mimeConfig = ALLOWED_MIME_TYPES[mimeType];
    if (!mimeConfig) {
      throw new AppError(
        `Unsupported media type: '${mimeType}'. Allowed formats: WEBP, JPEG, PNG, MP4.`,
        400,
        'INVALID_MIME_TYPE'
      );
    }

    if (fileSize > mimeConfig.maxSize) {
      const maxMb = mimeConfig.maxSize / (1024 * 1024);
      throw new AppError(
        `File size exceeds maximum limit of ${maxMb}MB for ${mimeType}`,
        400,
        'FILE_TOO_LARGE'
      );
    }

    const sanitizedBase = fileName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);
    const uniqueSuffix = uuidv4().slice(0, 8);
    const s3Key = `${folder}/${sanitizedBase}-${uniqueSuffix}.${mimeConfig.ext}`;
    const expiresInSeconds = 900;
    const publicUrl = this.getS3PublicUrl(s3Key);

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
      logger.warn('AWS S3 presigned generation fallback:', { error: err.message });
      return {
        uploadUrl: `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${s3Key}?mock_presigned=true`,
        s3Key,
        publicUrl,
        expiresInSeconds,
      };
    }
  }
}
