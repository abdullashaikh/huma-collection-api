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

const PRODUCTS_BATCH_2: AbayaSeedItem[] = [
  {
    imageLocalPath: 'C:/Users/abdul/.gemini/antigravity/brain/0947e061-4d2a-4a2c-aef1-e69b8bd69f9a/.user_uploaded/media_1791827662058_45bc3892.jpg',
    name: 'Marble Brushstroke Lavender A-Line Abaya',
    slug: 'marble-brushstroke-lavender-a-line-abaya',
    skuBase: 'HHC-ABY-006',
    fabric: 'Printed Twill Silk Crepe',
    materials: 'Premium Breathable Twill Crepe with Piped Bodice Detailing',
    pattern: 'Abstract Marbled Brushstroke',
    style: 'A-Line V-Neck with Geometric Piped Bodice Accents',
    colors: [
      { name: 'Slate Lavender', hex: '#7A7088' },
      { name: 'Charcoal Black', hex: '#2C2B30' },
    ],
    tags: ['abaya', 'printed abaya', 'marble abaya', 'lavender abaya', 'modern modest', 'a-line abaya', 'designer abaya'],
    careInstructions: 'Gentle machine wash cold or dry clean. Do not tumble dry. Cool iron on reverse.',
    shortDescription: 'Artistic slate-lavender and charcoal marbled crepe abaya featuring vertical piped bodice stripes with diamond drop endings and flowing A-line silhouette.',
    description: 'Express modern elegance with the Marble Brushstroke Lavender A-Line Abaya. Crafted from lightweight, non-sheer twill silk crepe, this striking piece showcases a mesmerizing watercolor marble pattern in slate lavender and charcoal tones. The bodice is elevated with vertical black piped lines culminating in crisp diamond embroidery accents at the chest, drawing the eye vertically for a flattering elongated drape.',
    basePrice: 2499.00,
    salePrice: 1899.00,
    displayOrder: 6,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    seoTitle: 'Marble Brushstroke Lavender A-Line Abaya | Huma Collection',
    seoDescription: 'Shop the modern Marble Brushstroke Lavender A-Line Abaya with bodice piped detailing and luxury crepe fabric at Huma Collection.',
  },
  {
    imageLocalPath: 'C:/Users/abdul/.gemini/antigravity/brain/0947e061-4d2a-4a2c-aef1-e69b8bd69f9a/.user_uploaded/media_1791827662070_5554bbc6.jpg',
    name: '2-Piece Periwinkle Floral Kimono & Slip Dress Abaya Set',
    slug: '2-piece-periwinkle-floral-kimono-slip-dress-abaya-set',
    skuBase: 'HHC-ABY-007',
    fabric: 'Soft Korean Chiffon & Rayon Crepe Blend',
    materials: 'Lightweight Flowing Chiffon with Opaque Inner Slip Dress',
    pattern: 'Watercolor Botanical Floral',
    style: '2-Piece Layered Set (Open Shrug Kimono + Inner Tie-Neck Slip Dress)',
    colors: [
      { name: 'Dusty Periwinkle', hex: '#92A1B9' },
      { name: 'Floral Ivory', hex: '#F5F4F0' },
    ],
    tags: ['abaya', '2 piece abaya', 'floral abaya', 'shrug abaya', 'kimono abaya', 'co-ord set', 'summer modest'],
    careInstructions: 'Hand wash cold or gentle machine wash in mesh laundry bag. Hang dry in shade. Warm steam iron.',
    shortDescription: 'Effortless 2-piece modest set featuring a dusty periwinkle inner slip dress with neck tie bow and an ivory floral watercolor open kimono outer shrug.',
    description: 'Fresh, airy, and ultra-versatile, this 2-Piece Periwinkle Floral Abaya Set combines a tailored dusty blue-periwinkle slip dress with an ivory watercolor botanical print open kimono. The inner dress features an elegant high collar with an attached self-tie neck ribbon, while the outer cape cascades with wide bell sleeves for grace in every stride. Wear together as a coordinated ensemble or style each piece independently.',
    basePrice: 2999.00,
    salePrice: 2299.00,
    displayOrder: 7,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    seoTitle: '2-Piece Periwinkle Floral Kimono Abaya Set | Huma Collection',
    seoDescription: 'Buy the chic 2-Piece Periwinkle Floral Kimono & Slip Dress Abaya Set in soft Korean chiffon at Huma Collection.',
  },
  {
    imageLocalPath: 'C:/Users/abdul/.gemini/antigravity/brain/0947e061-4d2a-4a2c-aef1-e69b8bd69f9a/.user_uploaded/media_1791827662080_6c5183b8.jpg',
    name: 'Cascading Crystal Vine Hand-Beaded Black Abaya',
    slug: 'cascading-crystal-vine-hand-beaded-black-abaya',
    skuBase: 'HHC-ABY-008',
    fabric: 'Saudi Royal Rich Crepe',
    materials: 'Heavyweight Royal Crepe with Handcrafted Glass & Bugle Crystal Beads',
    pattern: 'Cascading Botanical Vine Beading',
    style: 'Haute Couture Open Kimono with Matching Chiffon Scarf',
    colors: [{ name: 'Pitch Black', hex: '#0A0A0A' }],
    tags: ['abaya', 'black abaya', 'beaded abaya', 'crystal abaya', 'dubai abaya', 'wedding abaya', 'luxury modest'],
    careInstructions: 'Dry clean only due to intricate handcrafted crystal bead embroidery. Do not machine wash.',
    shortDescription: 'Opulent pitch-black Saudi royal crepe abaya adorned with cascading hand-beaded crystalline vine embroidery across the shoulders, bodice, and sleeves.',
    description: 'Designed for extraordinary moments, the Cascading Crystal Vine Hand-Beaded Black Abaya exemplifies Dubai couture luxury. Crafted from dense, midnight-black Saudi royal crepe with an incomparable fluid drape, it is adorned with thousands of hand-sewn black and gunmetal glass bugle beads shaped into organic branching vines across the shoulders, down the chest, and along the sleeves. Includes a coordinated lightweight chiffon scarf.',
    basePrice: 3299.00,
    salePrice: 2499.00,
    displayOrder: 8,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    seoTitle: 'Cascading Crystal Vine Hand-Beaded Black Abaya | Huma Collection',
    seoDescription: 'Order the luxurious Cascading Crystal Vine Hand-Beaded Black Abaya in Saudi Royal Crepe at Huma Collection.',
  },
  {
    imageLocalPath: 'C:/Users/abdul/.gemini/antigravity/brain/0947e061-4d2a-4a2c-aef1-e69b8bd69f9a/.user_uploaded/media_1791827662090_25c660f3.jpg',
    name: 'Executive Silver Pinstripe Minimalist Black Abaya',
    slug: 'executive-silver-pinstripe-minimalist-black-abaya',
    skuBase: 'HHC-ABY-009',
    fabric: 'Saudi Nida Matte Crepe',
    materials: 'High-Grade Saudi Nida with Silver Metallic Thread Pinstriping',
    pattern: 'Vertical Linear Pinstripes & Banded Cuffs',
    style: 'V-Neck Placket Front with 5-Row Striped Cuffs',
    colors: [
      { name: 'Obsidian Black', hex: '#0B0B0B' },
      { name: 'Silver Thread', hex: '#E2E2E2' },
    ],
    tags: ['abaya', 'pinstripe abaya', 'silver abaya', 'minimalist abaya', 'black abaya', 'office wear', 'nida fabric'],
    careInstructions: 'Machine wash cold on gentle cycle inside out. Hang dry. Steam press.',
    shortDescription: 'Clean-cut, tailored Saudi Nida black abaya accented with sleek vertical metallic silver pinstripe embroidery down the front and 5-stripe cuff details.',
    description: 'Sharp, poised, and contemporary. The Executive Silver Pinstripe Minimalist Black Abaya brings a structured, professional touch to everyday modesty. Spun from wrinkle-resistant, matte Saudi Nida crepe, it features fine metallic silver embroidery columns running the full vertical length of the front placket to elongate the figure, complemented by clean matching 5-stripe cuff bands on the wide sleeves. A wardrobe staple for professional and casual wear.',
    basePrice: 2399.00,
    salePrice: 1799.00,
    displayOrder: 9,
    isFeatured: true,
    isBestseller: false,
    isNewArrival: true,
    seoTitle: 'Executive Silver Pinstripe Minimalist Black Abaya | Huma Collection',
    seoDescription: 'Shop the Executive Silver Pinstripe Minimalist Black Abaya in premium Saudi Nida fabric at Huma Collection.',
  },
  {
    imageLocalPath: 'C:/Users/abdul/.gemini/antigravity/brain/0947e061-4d2a-4a2c-aef1-e69b8bd69f9a/.user_uploaded/media_1791827662095_bffaed2d.jpg',
    name: '2-Piece Shimmer Sage Green Organza & Crepe Abaya Set',
    slug: '2-piece-shimmer-sage-green-organza-crepe-abaya-set',
    skuBase: 'HHC-ABY-010',
    fabric: 'Luminous Shimmer Silk Organza Outer & Textured Crepe Inner',
    materials: 'Metallic Sheen Organza with Intricate Geometric Silver Border Trims',
    pattern: 'Subtle Luminous Sheen with Embroidered Silver Trim',
    style: '2-Piece Layered Set (Sheer Shimmer Kimono + Tie-Neck Crepe Slip Dress)',
    colors: [
      { name: 'Shimmer Sage Green', hex: '#8FA89B' },
      { name: 'Silver Trim', hex: '#F0F0F0' },
    ],
    tags: ['abaya', 'sage green abaya', '2 piece abaya', 'organza abaya', 'shimmer abaya', 'party wear abaya', 'eid collection'],
    careInstructions: 'Dry clean only to protect delicate shimmering organza and embroidered metallic borders.',
    shortDescription: 'Enchanting 2-piece abaya set with a radiant sage green sheer shimmer organza outer kimono trimmed with silver embroidery, paired with a matching bow-neck crepe slip dress.',
    description: 'Capture radiant grace with the 2-Piece Shimmer Sage Green Organza Abaya Set. Featuring a lustrous sheer organza shrug in a serene sage-mint hue that glistens softly in ambient light, framed with delicate silver geometric embroidered borders along the open front and cuffs. Accompanied by an opaque textured crepe inner slip dress complete with a chic neck tie bow. Designed for Eid, festive receptions, and high-profile celebrations.',
    basePrice: 3199.00,
    salePrice: 2399.00,
    displayOrder: 10,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    seoTitle: '2-Piece Shimmer Sage Green Organza Abaya Set | Huma Collection',
    seoDescription: 'Discover the luxurious 2-Piece Shimmer Sage Green Organza & Crepe Abaya Set at Huma Collection.',
  },
];

const SIZES_CONFIG = [
  { sizeStr: '52', attrValId: 2, stock: 15 },
  { sizeStr: '54', attrValId: 3, stock: 20 },
  { sizeStr: '56', attrValId: 4, stock: 18 },
  { sizeStr: '58', attrValId: 5, stock: 12 },
];

async function seedBatch2() {
  console.log('====================================================');
  console.log(' Starting Ingestion for Batch 2: 5 New Abaya Products');
  console.log('====================================================\n');

  const adminId = 1;
  const categoryId = 3; // Abaya
  const secondaryCatId = 1; // Burqa Collection

  for (const item of PRODUCTS_BATCH_2) {
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

          await conn.query(
            `INSERT INTO inventory_transactions (
              variant_id, transaction_type, quantity_change, previous_stock, current_stock,
              reference_type, notes, created_by_admin_id
            ) VALUES (?, 'RESTOCK', ?, 0, ?, 'ADMIN_PRODUCT_CREATE', 'Initial inventory seed', ?)`,
            [variantId, sizeCfg.stock, sizeCfg.stock, adminId]
          );
        }

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
  console.log(' All 5 Batch 2 Abaya products successfully ingested and live!');
  console.log('====================================================\n');
}

seedBatch2()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error seeding batch 2 abayas:', err);
    process.exit(1);
  });
