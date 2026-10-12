import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
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

interface AbayaSeedItem {
  imageLocalPath: string;
  name: string;
  slug: string;
  skuBase: string;
  fabric: string;
  materials: string;
  pattern: string;
  style: string;
  colors: Array<{ name: string; hex: string }>;
  tags: string[];
  careInstructions: string;
  shortDescription: string;
  description: string;
  basePrice: number;
  salePrice: number;
  displayOrder: number;
  isFeatured: boolean;
  isBestseller: boolean;
  isNewArrival: boolean;
  seoTitle: string;
  seoDescription: string;
}

const PRODUCTS_TO_SEED: AbayaSeedItem[] = [
  {
    imageLocalPath: 'C:/Users/abdul/.gemini/antigravity/brain/0947e061-4d2a-4a2c-aef1-e69b8bd69f9a/.user_uploaded/media_1791826178509_e0d59ea6.jpg',
    name: 'Classic Shirt-Collar Button-Down Abaya',
    slug: 'classic-shirt-collar-button-down-abaya',
    skuBase: 'HHC-ABY-001',
    fabric: 'Premium Soft Korean Crepe',
    materials: '100% Breathable Matte Korean Crepe',
    pattern: 'Solid Plain',
    style: 'Shirt Collar Placket with Smocked Cuffs',
    colors: [{ name: 'Jet Black', hex: '#0D0D0D' }],
    tags: ['abaya', 'shirt abaya', 'black abaya', 'office wear', 'modest luxury', 'smocked cuffs'],
    careInstructions: 'Machine wash cold on gentle cycle or hand wash. Hang to dry in shade. Warm iron if needed.',
    shortDescription: 'Contemporary shirt-style black abaya crafted from soft Korean matte crepe, featuring a structured lapel collar, refined front button placket, and stretch-smocked ruffled cuffs.',
    description: 'Elevate your everyday modest wardrobe with our Classic Shirt-Collar Button-Down Abaya. Expertly tailored from high-grade Korean matte crepe, this piece offers an ultra-soft drape that resists creasing throughout the day. Designed with an elegant structured collar, practical front-opening button placket, and comfortable smocked elasticated cuffs with ruffled trim. Perfect for professional settings, daily errands, or elevated casual gatherings.',
    basePrice: 2299.00,
    salePrice: 1699.00,
    displayOrder: 1,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    seoTitle: 'Classic Shirt-Collar Button-Down Black Abaya | Huma Collection',
    seoDescription: 'Shop our premium Shirt-Collar Button-Down Black Abaya made with luxury Korean crepe fabric, smocked cuffs, and button front at Huma Collection.',
  },
  {
    imageLocalPath: 'C:/Users/abdul/.gemini/antigravity/brain/0947e061-4d2a-4a2c-aef1-e69b8bd69f9a/.user_uploaded/media_1791826178517_5c009137.jpg',
    name: 'Artisan Beaded Taupe Grey Textured Abaya',
    slug: 'artisan-beaded-taupe-grey-textured-abaya',
    skuBase: 'HHC-ABY-002',
    fabric: 'Crinkled Textured Crepe & Raw Silk Blend',
    materials: 'Textured Crepe Blend with Hand-Stitched Glass Beads',
    pattern: 'Vertical Linear Hand Beading',
    style: 'Modest Open Front Kimono with Beaded Accents & Tassels',
    colors: [{ name: 'Muted Taupe Grey', hex: '#8E857B' }],
    tags: ['abaya', 'taupe abaya', 'grey abaya', 'beaded abaya', 'festive abaya', 'handwork', 'tassels'],
    careInstructions: 'Dry clean only recommended due to delicate handcrafted beadwork and tassels. Low steam iron on reverse.',
    shortDescription: 'Exquisite muted taupe-grey textured crepe abaya adorned with vertical geometric hand-beaded embroidery, dangling tassel accents, and flowing bell sleeves.',
    description: 'A masterpiece of artisanal craftsmanship, the Artisan Beaded Taupe Grey Abaya features an earthy, textured crepe finish that provides rich depth and an airy, effortless silhouette. Vertical columns of delicate tonal glass beading and subtle hanging tassels run along the front, elongating the frame while catching soft light. An ideal statement piece for celebratory occasions, Eid, and formal gatherings.',
    basePrice: 2899.00,
    salePrice: 2199.00,
    displayOrder: 2,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    seoTitle: 'Artisan Beaded Taupe Grey Textured Abaya | Huma Collection',
    seoDescription: 'Order the handcrafted Artisan Beaded Taupe Grey Abaya with delicate beadwork and tassel details. Premium modest wear from Huma Collection.',
  },
  {
    imageLocalPath: 'C:/Users/abdul/.gemini/antigravity/brain/0947e061-4d2a-4a2c-aef1-e69b8bd69f9a/.user_uploaded/media_1791826178522_5c42dbf6.jpg',
    name: 'Modern Mandarin Collar Ring-Zip Black Abaya',
    slug: 'modern-mandarin-collar-ring-zip-black-abaya',
    skuBase: 'HHC-ABY-003',
    fabric: 'Saudi Nida Matte Crepe',
    materials: 'High-Density Saudi Nida with Silver Metallic Hardware',
    pattern: 'Minimalist Architectural Accent',
    style: 'High Mandarin Collar Front Zip Utility Abaya',
    colors: [{ name: 'Pitch Black', hex: '#0B0B0B' }],
    tags: ['abaya', 'zipper abaya', 'ring zip', 'mandarin collar', 'nida fabric', 'modern modest', 'black abaya'],
    careInstructions: 'Machine wash cold inside out with like colors. Do not bleach. Cool iron or steam.',
    shortDescription: 'Sleek, modern minimalist black abaya crafted from Saudi Nida fabric, featuring an upright mandarin collar, statement silver ring-pull zipper, and metallic accent tabs.',
    description: 'Designed for the modern Muslim woman on the go, the Modern Mandarin Collar Ring-Zip Abaya combines utilitarian function with refined modest tailoring. Cut from opaque, wrinkle-resistant Saudi Nida matte crepe, it features a smooth full-length front zip secured with an eye-catching silver circular ring pull. Accent metallic hardware tabs along the placket and cuffs add a subtle, edgy flair without compromising modesty.',
    basePrice: 2499.00,
    salePrice: 1899.00,
    displayOrder: 3,
    isFeatured: true,
    isBestseller: false,
    isNewArrival: true,
    seoTitle: 'Modern Mandarin Collar Ring-Zip Black Abaya | Huma Collection',
    seoDescription: 'Discover our Modern Mandarin Collar Ring-Zip Abaya in Saudi Nida matte crepe with statement hardware accents at Huma Collection.',
  },
  {
    imageLocalPath: 'C:/Users/abdul/.gemini/antigravity/brain/0947e061-4d2a-4a2c-aef1-e69b8bd69f9a/.user_uploaded/media_1791826178565_c1940c00.jpg',
    name: 'Shimmer Champagne Pearl Pleated Royal Abaya',
    slug: 'shimmer-champagne-pearl-pleated-royal-abaya',
    skuBase: 'HHC-ABY-004',
    fabric: 'Pleated Shimmer Organza Tissue Crepe',
    materials: 'Fine Pleated Poly-Organza with Luminous Pearl Luster',
    pattern: 'Micro Accordion Pleats',
    style: 'High Ruffle Neck Gown Abaya with Fluted Bell Cuffs',
    colors: [{ name: 'Champagne Pearl', hex: '#E6DFD3' }],
    tags: ['abaya', 'champagne abaya', 'pleated abaya', 'luxury abaya', 'party wear abaya', 'flute sleeve', 'wedding abaya'],
    careInstructions: 'Dry clean only to maintain pleated structure and delicate shimmer finish. Do not iron directly.',
    shortDescription: 'Opulent champagne pearl abaya in fine micro-pleated shimmer tissue crepe, accented with a ruffled Victorian neckline, neck tie drape, and flared bell cuffs.',
    description: 'Radiate elegance with the Shimmer Champagne Pearl Pleated Royal Abaya. Cut from a luminous shimmer organza blend that glows subtly under any lighting, this abaya showcases precision accordion pleats that cascade down into a voluminous sweep. The high neck is finished with a romantic ruffled collar and matching tie-up neck sash, balanced by dramatic fluted cuffs. A timeless showstopper for weddings and festive evenings.',
    basePrice: 3199.00,
    salePrice: 2399.00,
    displayOrder: 4,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    seoTitle: 'Shimmer Champagne Pearl Pleated Royal Abaya | Huma Collection',
    seoDescription: 'Shop the breathtaking Shimmer Champagne Pearl Pleated Royal Abaya with ruffled high neck and flute sleeves at Huma Collection.',
  },
  {
    imageLocalPath: 'C:/Users/abdul/.gemini/antigravity/brain/0947e061-4d2a-4a2c-aef1-e69b8bd69f9a/.user_uploaded/media_1791826178563_736fc0e0.jpg',
    name: 'Midnight Black Crystal Fringe V-Neck Abaya',
    slug: 'midnight-black-crystal-fringe-v-neck-abaya',
    skuBase: 'HHC-ABY-005',
    fabric: 'Saudi Royal Rich Crepe',
    materials: 'Premium Royal Crepe with Black Faceted Crystal Tassels & Satin Ties',
    pattern: 'Solid with Crystal Fringe Embellishment',
    style: 'V-Neckline with Crystal Tassel Fringe & Drape Ties',
    colors: [{ name: 'Midnight Black', hex: '#0A0A0A' }],
    tags: ['abaya', 'crystal abaya', 'v-neck abaya', 'evening abaya', 'black abaya', 'tassel fringe', 'dubai style'],
    careInstructions: 'Dry clean or gentle hand wash cold. Avoid rubbing embellished areas. Steam press lightly.',
    shortDescription: 'Glamorous midnight black abaya in Saudi royal crepe, featuring a refined V-neckline adorned with cascading black crystal bead fringe tassels and satin tie ribbons.',
    description: 'Understated luxury redefined. The Midnight Black Crystal Fringe V-Neck Abaya combines rich Saudi royal crepe with exquisite handcrafted black crystal tassels that sway gently with every movement. The delicate V-neck is highlighted by soft neck ties that can be styled loosely or tied into a chic modest knot. Tailored with a relaxed yet structured fit that ensures maximum modesty and comfort for evenings and special occasions.',
    basePrice: 2999.00,
    salePrice: 2299.00,
    displayOrder: 5,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    seoTitle: 'Midnight Black Crystal Fringe V-Neck Abaya | Huma Collection',
    seoDescription: 'Buy Midnight Black Crystal Fringe V-Neck Abaya featuring hand-applied crystal bead tassels in Saudi Royal Crepe at Huma Collection.',
  },
];

// Sizes configuration: 52, 54, 56, 58
// Map to existing attribute_value_ids from DB:
// 2 -> 52 (Height 5'1" - 5'2")
// 3 -> 54 (Height 5'3" - 5'4")
// 4 -> 56 (Height 5'5" - 5'6")
// 5 -> 58 (Height 5'7" - 5'8")
const SIZES_CONFIG = [
  { sizeStr: '52', attrValId: 2, stock: 15 },
  { sizeStr: '54', attrValId: 3, stock: 20 },
  { sizeStr: '56', attrValId: 4, stock: 18 },
  { sizeStr: '58', attrValId: 5, stock: 12 },
];

async function seedAbayas() {
  console.log('====================================================');
  console.log(' Starting Ingestion for 5 New User Abaya Products');
  console.log('====================================================\n');

  const adminId = 1;
  const categoryId = 3; // Abaya
  const secondaryCatId = 1; // Burqa Collection

  for (const item of PRODUCTS_TO_SEED) {
    console.log(`\n----------------------------------------------------`);
    console.log(`Processing: ${item.name} (${item.skuBase})`);
    console.log(`----------------------------------------------------`);

    if (!fs.existsSync(item.imageLocalPath)) {
      throw new Error(`Source image not found: ${item.imageLocalPath}`);
    }

    // 1. Read and compress local image
    const rawBuffer = await fs.promises.readFile(item.imageLocalPath);
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
    const s3Key = `products/abaya-${item.slug}-${uniqueSuffix}.webp`;

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
      // Check if existing product with same slug or SKU base exists
      const [existing]: any = await conn.query(
        'SELECT id FROM products WHERE slug = ? OR sku_base = ?',
        [item.slug, item.skuBase]
      );

      let productId: number;

      if (existing.length > 0) {
        productId = existing[0].id;
        console.log(`Existing product found with ID ${productId}. Updating product...`);

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
            item.name,
            item.slug,
            item.skuBase,
            item.shortDescription,
            item.description,
            item.fabric,
            item.materials,
            item.pattern,
            item.style,
            JSON.stringify(item.colors),
            JSON.stringify(item.tags),
            item.careInstructions,
            item.basePrice,
            item.salePrice,
            item.displayOrder,
            item.isFeatured ? 1 : 0,
            item.isBestseller ? 1 : 0,
            item.isNewArrival ? 1 : 0,
            item.seoTitle,
            item.seoDescription,
            productId,
          ]
        );
      } else {
        console.log(`Inserting new product record...`);
        const [pRes]: any = await conn.query(
          `INSERT INTO products (
            category_id, subcategory_id, audience, name, slug, sku_base, short_description, description,
            fabric, materials, pattern, style, colors, tags, care_instructions, base_price, sale_price,
            display_order, is_featured, is_bestseller, is_new_arrival, status, seo_title, seo_description
          ) VALUES (?, NULL, 'WOMEN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
          [
            categoryId,
            item.name,
            item.slug,
            item.skuBase,
            item.shortDescription,
            item.description,
            item.fabric,
            item.materials,
            item.pattern,
            item.style,
            JSON.stringify(item.colors),
            JSON.stringify(item.tags),
            item.careInstructions,
            item.basePrice,
            item.salePrice,
            item.displayOrder,
            item.isFeatured ? 1 : 0,
            item.isBestseller ? 1 : 0,
            item.isNewArrival ? 1 : 0,
            item.seoTitle,
            item.seoDescription,
          ]
        );
        productId = pRes.insertId;
        console.log(`Created new product ID: ${productId}`);
      }

      // Map primary category (Abaya) and secondary (Burqa Collection)
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

      // Insert primary image
      await conn.query('DELETE FROM product_images WHERE product_id = ?', [productId]);
      await conn.query(
        `INSERT INTO product_images (product_id, s3_key, s3_url, alt_text, sort_order, is_primary, view_type)
         VALUES (?, ?, ?, ?, 1, 1, 'FRONT')`,
        [productId, s3Key, s3Url, `${item.name} Front View`]
      );
      console.log(`Linked primary image in product_images.`);

      // Create variants for sizes 52, 54, 56, 58
      for (const sizeCfg of SIZES_CONFIG) {
        const variantSku = `${item.skuBase}-${sizeCfg.sizeStr}`;

        // Check if variant exists
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
            [item.salePrice, item.basePrice, sizeCfg.stock, variantId]
          );
        } else {
          const [vRes]: any = await conn.query(
            `INSERT INTO product_variants (
              product_id, sku, price, compare_at_price, stock_quantity, low_stock_threshold, is_active
            ) VALUES (?, ?, ?, ?, ?, 5, 1)`,
            [productId, variantSku, item.salePrice, item.basePrice, sizeCfg.stock]
          );
          variantId = vRes.insertId;

          // Record initial restock inventory transaction
          await conn.query(
            `INSERT INTO inventory_transactions (
              variant_id, transaction_type, quantity_change, previous_stock, current_stock,
              reference_type, notes, created_by_admin_id
            ) VALUES (?, 'RESTOCK', ?, 0, ?, 'ADMIN_PRODUCT_CREATE', 'Initial inventory seed', ?)`,
            [variantId, sizeCfg.stock, sizeCfg.stock, adminId]
          );
        }

        // Link variant attribute (Size)
        await conn.query(
          `INSERT IGNORE INTO product_variant_attributes (variant_id, attribute_value_id) VALUES (?, ?)`,
          [variantId, sizeCfg.attrValId]
        );
      }
      console.log(`Linked 4 size variants (52, 54, 56, 58) with inventory.`);

      // Admin audit log
      await conn.query(
        `INSERT INTO admin_audit_logs (admin_id, action, resource_type, resource_id, new_values, ip_address)
         VALUES (?, 'CREATE_PRODUCT', 'PRODUCT', ?, ?, '127.0.0.1')`,
        [
          adminId,
          productId.toString(),
          JSON.stringify({
            name: item.name,
            slug: item.slug,
            skuBase: item.skuBase,
            basePrice: item.basePrice,
            salePrice: item.salePrice,
          }),
        ]
      );
    });

    console.log(`✓ Product '${item.name}' added successfully!`);
  }

  console.log('\n====================================================');
  console.log(' All 5 Abaya products successfully ingested and live!');
  console.log('====================================================\n');
}

seedAbayas()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error seeding abayas:', err);
    process.exit(1);
  });
