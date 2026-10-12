import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fs from 'fs';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { pool, withTransaction } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { MediaService } from '../modules/media/media.service';

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

async function seedHijab() {
  console.log('====================================================');
  console.log(' Starting Ingestion for French Khimar Hijab Product');
  console.log('====================================================\n');

  const localImagePath = 'C:/Users/abdul/.gemini/antigravity/brain/0947e061-4d2a-4a2c-aef1-e69b8bd69f9a/.user_uploaded/media_1791829220651_0d70ef91.jpg';
  const adminId = 1;
  const categoryId = 2; // Hijab
  const secondaryCatId = 1; // Burqa Collection

  if (!fs.existsSync(localImagePath)) {
    throw new Error(`Source image not found at: ${localImagePath}`);
  }

  // 1. Read and compress local image
  const rawBuffer = await fs.promises.readFile(localImagePath);
  const originalKb = (rawBuffer.length / 1024).toFixed(1);

  const compressedBuffer = await sharp(rawBuffer)
    .rotate()
    .resize({
      width: 1600,
      height: 2400,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 85, effort: 4 })
    .toBuffer();

  const compressedKb = (compressedBuffer.length / 1024).toFixed(1);
  console.log(`Image compressed: ${originalKb} KB -> ${compressedKb} KB`);

  // 2. Upload to S3
  const uniqueSuffix = uuidv4().slice(0, 8);
  const s3Key = `products/hijab-premium-french-khimar-overhead-instant-jersey-${uniqueSuffix}.webp`;

  console.log(`Uploading to AWS S3: ${s3Key}...`);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: compressedBuffer,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  const s3Url = MediaService.getS3PublicUrl(s3Key);
  console.log(`Uploaded! Public URL: ${s3Url}`);

  // 3. Database operations
  await withTransaction(async (conn) => {
    // Ensure "Free Size" exists in product_attribute_values
    const [attrCheck]: any = await conn.query(
      "SELECT id FROM product_attribute_values WHERE attribute_id = 1 AND value LIKE '%Free Size%'"
    );
    let freeSizeAttrId: number;
    if (attrCheck.length > 0) {
      freeSizeAttrId = attrCheck[0].id;
    } else {
      const [insertAttr]: any = await conn.query(
        "INSERT INTO product_attribute_values (attribute_id, value) VALUES (1, 'Free Size (One Size Fits All)')"
      );
      freeSizeAttrId = insertAttr.insertId;
    }
    console.log(`Free Size Attribute Value ID: ${freeSizeAttrId}`);

    const name = 'Premium French Khimar Overhead Instant Jersey Hijab';
    const slug = 'premium-french-khimar-overhead-instant-jersey-hijab';
    const skuBase = 'HHC-HJB-002';
    const shortDescription = 'Full-coverage French Khimar crafted from ultra-soft Korean modal stretch jersey with an integrated tie-back cap, sweeping bell flare, and non-slip breathable drape.';
    const description = 'Experience supreme coverage, effortless styling, and breathable all-day comfort with our Premium French Khimar Overhead Instant Jersey Hijab. Tailored from ultra-soft, opaque Korean modal stretch jersey, this instant khimar features an integrated tie-back cap that secures smoothly without pins. The wide sweeping flare drapes past the shoulders, chest, and waistline for total modesty. Suitable for daily modest wear, prayer, Hajj & Umrah, and versatile styling across 10 rich colorways shown in the palette.';
    const fabric = 'Korean Modal Stretch Jersey';
    const materials = '95% Premium Breathable Modal Viscose, 5% Spandex';
    const pattern = 'Solid Plain Long Flare';
    const style = 'Instant French Khimar with Integrated Tie-Back Headband';
    const colors = [
      { name: 'Cranberry Wine', hex: '#8A3348' },
      { name: 'Midnight Black', hex: '#0D0D0D' },
      { name: 'Dusty Mauve', hex: '#8E6B7A' },
      { name: 'Cream Beige', hex: '#D8C7A9' },
      { name: 'Mushroom Taupe', hex: '#8A7D76' },
      { name: 'Mustard Gold', hex: '#B8860B' },
      { name: 'Deep Purple', hex: '#4B2840' },
      { name: 'Pure White', hex: '#FFFFFF' },
    ];
    const tags = ['hijab', 'khimar', 'french khimar', 'instant hijab', 'prayer hijab', 'jersey hijab', 'overhead khimar', 'hajj umrah'];
    const careInstructions = 'Machine wash cold on gentle cycle or hand wash. Hang to dry in shade. Low steam iron.';
    const basePrice = 2299.00;
    const salePrice = 1699.00;
    const displayOrder = 1;
    const isFeatured = 1;
    const isBestseller = 1;
    const isNewArrival = 1;
    const seoTitle = 'Premium French Khimar Overhead Instant Jersey Hijab | Huma Collection';
    const seoDescription = 'Shop the full-coverage Premium French Khimar Overhead Instant Jersey Hijab in Korean modal stretch jersey at Huma Collection.';

    // Check if product exists
    const [existing]: any = await conn.query(
      'SELECT id FROM products WHERE slug = ? OR sku_base = ?',
      [slug, skuBase]
    );

    let productId: number;
    if (existing.length > 0) {
      productId = existing[0].id;
      console.log(`Updating existing product ID ${productId}...`);
      await conn.query(
        `UPDATE products SET
          category_id = ?, audience = 'WOMEN', name = ?, slug = ?, sku_base = ?,
          short_description = ?, description = ?, fabric = ?, materials = ?, pattern = ?,
          style = ?, colors = ?, tags = ?, care_instructions = ?, base_price = ?,
          sale_price = ?, display_order = ?, is_featured = ?, is_bestseller = ?,
          is_new_arrival = ?, status = 'ACTIVE', seo_title = ?, seo_description = ?,
          deleted_at = NULL
         WHERE id = ?`,
        [
          categoryId,
          name,
          slug,
          skuBase,
          shortDescription,
          description,
          fabric,
          materials,
          pattern,
          style,
          JSON.stringify(colors),
          JSON.stringify(tags),
          careInstructions,
          basePrice,
          salePrice,
          displayOrder,
          isFeatured,
          isBestseller,
          isNewArrival,
          seoTitle,
          seoDescription,
          productId,
        ]
      );
    } else {
      console.log('Inserting new product record...');
      const [pRes]: any = await conn.query(
        `INSERT INTO products (
          category_id, subcategory_id, audience, name, slug, sku_base, short_description, description,
          fabric, materials, pattern, style, colors, tags, care_instructions, base_price, sale_price,
          display_order, is_featured, is_bestseller, is_new_arrival, status, seo_title, seo_description
        ) VALUES (?, NULL, 'WOMEN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
        [
          categoryId,
          name,
          slug,
          skuBase,
          shortDescription,
          description,
          fabric,
          materials,
          pattern,
          style,
          JSON.stringify(colors),
          JSON.stringify(tags),
          careInstructions,
          basePrice,
          salePrice,
          displayOrder,
          isFeatured,
          isBestseller,
          isNewArrival,
          seoTitle,
          seoDescription,
        ]
      );
      productId = pRes.insertId;
      console.log(`Created new product ID: ${productId}`);
    }

    // Category mapping
    await conn.query(
      `INSERT INTO product_category_mappings (product_id, category_id, is_primary) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE is_primary = 1`,
      [productId, categoryId]
    );
    await conn.query(
      `INSERT INTO product_category_mappings (product_id, category_id, is_primary) VALUES (?, ?, 0)
       ON DUPLICATE KEY UPDATE is_primary = 0`,
      [productId, secondaryCatId]
    );

    // Primary image
    await conn.query('DELETE FROM product_images WHERE product_id = ?', [productId]);
    await conn.query(
      `INSERT INTO product_images (product_id, s3_key, s3_url, alt_text, sort_order, is_primary, view_type)
       VALUES (?, ?, ?, ?, 1, 1, 'FRONT')`,
      [productId, s3Key, s3Url, `${name} Full View`]
    );
    console.log(`Linked primary image in product_images.`);

    // Variants for top color choices in Free Size
    const VARIANTS_LIST = [
      { colorSuffix: 'CRN', colorName: 'Cranberry Wine', stock: 40 },
      { colorSuffix: 'BLK', colorName: 'Midnight Black', stock: 35 },
      { colorSuffix: 'MVE', colorName: 'Dusty Mauve', stock: 25 },
      { colorSuffix: 'BGE', colorName: 'Cream Beige', stock: 30 },
      { colorSuffix: 'TPE', colorName: 'Mushroom Taupe', stock: 25 },
      { colorSuffix: 'MST', colorName: 'Mustard Gold', stock: 20 },
      { colorSuffix: 'WHT', colorName: 'Pure White', stock: 25 },
    ];

    for (const v of VARIANTS_LIST) {
      const variantSku = `${skuBase}-${v.colorSuffix}-FS`;

      const [existingVar]: any = await conn.query(
        'SELECT id FROM product_variants WHERE product_id = ? AND sku = ?',
        [productId, variantSku]
      );

      let variantId: number;
      if (existingVar.length > 0) {
        variantId = existingVar[0].id;
        await conn.query(
          `UPDATE product_variants SET
            price = ?, compare_at_price = ?, stock_quantity = ?, is_active = 1
           WHERE id = ?`,
          [salePrice, basePrice, v.stock, variantId]
        );
      } else {
        const [vRes]: any = await conn.query(
          `INSERT INTO product_variants (
            product_id, sku, price, compare_at_price, stock_quantity, low_stock_threshold, is_active
          ) VALUES (?, ?, ?, ?, ?, 5, 1)`,
          [productId, variantSku, salePrice, basePrice, v.stock]
        );
        variantId = vRes.insertId;

        await conn.query(
          `INSERT INTO inventory_transactions (
            variant_id, transaction_type, quantity_change, previous_stock, current_stock,
            reference_type, notes, created_by_admin_id
          ) VALUES (?, 'RESTOCK', ?, 0, ?, 'ADMIN_PRODUCT_CREATE', 'Initial inventory seed', ?)`,
          [variantId, v.stock, v.stock, adminId]
        );
      }

      // Link Free Size
      await conn.query(
        `INSERT IGNORE INTO product_variant_attributes (variant_id, attribute_value_id) VALUES (?, ?)`,
        [variantId, freeSizeAttrId]
      );
    }
    console.log(`Linked ${VARIANTS_LIST.length} color variants in Free Size with inventory.`);

    // Admin audit log
    await conn.query(
      `INSERT INTO admin_audit_logs (admin_id, action, resource_type, resource_id, new_values, ip_address)
       VALUES (?, 'CREATE_PRODUCT', 'PRODUCT', ?, ?, '127.0.0.1')`,
      [
        adminId,
        productId.toString(),
        JSON.stringify({ name, slug, skuBase, basePrice, salePrice }),
      ]
    );
  });

  console.log('\n====================================================');
  console.log(' Premium French Khimar Hijab successfully added and live!');
  console.log('====================================================\n');
}

seedHijab()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error seeding hijab:', err);
    process.exit(1);
  });
