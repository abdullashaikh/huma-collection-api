import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { pool } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function optimizeExistingImages() {
  console.log('====================================================');
  console.log(' Starting Batch Optimization for High-Res Catalog Images');
  console.log('====================================================\n');

  // 1. Fetch all product images pointing to backend media proxy
  const [rows]: any = await pool.query(
    "SELECT id, product_id, s3_url, s3_key FROM product_images WHERE s3_url LIKE '%/api/v1/media/file/%'"
  );

  console.log(`Found ${rows.length} product images in database to analyze.\n`);

  let totalOriginalBytes = 0;
  let totalOptimizedBytes = 0;
  let optimizedCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    const rawUrl: string = row.s3_url;
    const parts = rawUrl.split('/api/v1/media/file/');
    if (parts.length < 2) continue;

    const currentKey = parts[1].split('?')[0];
    const host = rawUrl.substring(0, rawUrl.indexOf('/api/v1/media/file/'));

    try {
      // 1. Fetch file from S3
      const getRes = await s3Client.send(
        new GetObjectCommand({
          Bucket: env.AWS_S3_BUCKET,
          Key: currentKey,
        })
      );

      const originalBuffer = await streamToBuffer(getRes.Body);
      const originalSize = originalBuffer.length;
      totalOriginalBytes += originalSize;

      // Skip if already small WebP (< 300 KB and ends in .webp)
      if (currentKey.endsWith('.webp') && originalSize < 300 * 1024) {
        console.log(`✓ [SKIP] ID ${row.id} (${currentKey}) already optimized: ${(originalSize / 1024).toFixed(1)} KB`);
        totalOptimizedBytes += originalSize;
        skippedCount++;
        continue;
      }

      // 2. Compress with Sharp
      const compressedBuffer = await sharp(originalBuffer)
        .rotate() // Auto-orient based on EXIF
        .resize({
          width: 1600,
          height: 2400,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();

      const newSize = compressedBuffer.length;
      totalOptimizedBytes += newSize;

      const webpKey = currentKey.replace(/\.[^/.]+$/, '') + '.webp';
      const newUrl = `${host}/api/v1/media/file/${webpKey}`;

      // 3. Upload compressed WebP to S3 (both to new .webp key and update old key)
      await s3Client.send(
        new PutObjectCommand({
          Bucket: env.AWS_S3_BUCKET,
          Key: webpKey,
          Body: compressedBuffer,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );

      // Also overwrite original key so stale links get the tiny file immediately
      if (currentKey !== webpKey) {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: env.AWS_S3_BUCKET,
            Key: currentKey,
            Body: compressedBuffer,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000, immutable',
          })
        );
      }

      // 4. Update MySQL database record
      await pool.query(
        'UPDATE product_images SET s3_url = ?, s3_key = ? WHERE id = ?',
        [newUrl, webpKey, row.id]
      );

      const savedPercent = (((originalSize - newSize) / originalSize) * 100).toFixed(1);
      console.log(
        `⚡ [OPTIMIZED] ID ${row.id}: ${(originalSize / (1024 * 1024)).toFixed(2)} MB -> ${(newSize / 1024).toFixed(1)} KB (${savedPercent}% saved) -> ${webpKey}`
      );
      optimizedCount++;
    } catch (err: any) {
      console.error(`✗ [ERROR] Failed processing ${currentKey}:`, err.message);
    }
  }

  // 2. Also check product_categories
  const [catRows]: any = await pool.query(
    "SELECT id, name, image_url FROM product_categories WHERE image_url LIKE '%/api/v1/media/file/%'"
  );

  for (const cat of catRows) {
    const rawUrl: string = cat.image_url;
    const parts = rawUrl.split('/api/v1/media/file/');
    if (parts.length < 2) continue;

    const currentKey = parts[1].split('?')[0];
    const host = rawUrl.substring(0, rawUrl.indexOf('/api/v1/media/file/'));

    try {
      const getRes = await s3Client.send(
        new GetObjectCommand({
          Bucket: env.AWS_S3_BUCKET,
          Key: currentKey,
        })
      );

      const originalBuffer = await streamToBuffer(getRes.Body);
      const originalSize = originalBuffer.length;

      if (currentKey.endsWith('.webp') && originalSize < 300 * 1024) {
        continue;
      }

      const compressedBuffer = await sharp(originalBuffer)
        .rotate()
        .resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();

      const webpKey = currentKey.replace(/\.[^/.]+$/, '') + '.webp';
      const newUrl = `${host}/api/v1/media/file/${webpKey}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: env.AWS_S3_BUCKET,
          Key: webpKey,
          Body: compressedBuffer,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );

      if (currentKey !== webpKey) {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: env.AWS_S3_BUCKET,
            Key: currentKey,
            Body: compressedBuffer,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000, immutable',
          })
        );
      }

      await pool.query('UPDATE product_categories SET image_url = ? WHERE id = ?', [newUrl, cat.id]);
      console.log(`⚡ [CATEGORY OPTIMIZED] ${cat.name}: ${(originalSize / 1024).toFixed(1)} KB -> ${(compressedBuffer.length / 1024).toFixed(1)} KB`);
      optimizedCount++;
    } catch (err: any) {
      console.error(`✗ [ERROR] Failed processing category image ${currentKey}:`, err.message);
    }
  }

  console.log('\n====================================================');
  console.log(' Optimization Summary:');
  console.log(`   - Images Optimized: ${optimizedCount}`);
  console.log(`   - Images Skipped:   ${skippedCount}`);
  console.log(`   - Before Size:      ${(totalOriginalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`   - After Size:       ${(totalOptimizedBytes / (1024 * 1024)).toFixed(2)} MB`);
  const totalSavedMb = (totalOriginalBytes - totalOptimizedBytes) / (1024 * 1024);
  const totalSavedPct = totalOriginalBytes > 0 ? (((totalOriginalBytes - totalOptimizedBytes) / totalOriginalBytes) * 100).toFixed(1) : '0';
  console.log(`   - Total Saved:      ${totalSavedMb.toFixed(2)} MB (${totalSavedPct}% reduction)`);
  console.log('====================================================\n');
}

if (require.main === module) {
  optimizeExistingImages()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
