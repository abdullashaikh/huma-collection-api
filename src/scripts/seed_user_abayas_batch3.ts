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

const PRODUCTS_BATCH_3: AbayaSeedItem[] = [
  {
    imageLocalPath: 'C:/Users/abdul/.gemini/antigravity/brain/0947e061-4d2a-4a2c-aef1-e69b8bd69f9a/.user_uploaded/media_1791828094515_71030fb8.jpg',
    name: 'Midnight Charcoal Crushed Velvet Swirl Abaya',
    slug: 'midnight-charcoal-crushed-velvet-swirl-abaya',
    skuBase: 'HHC-ABY-011',
    fabric: 'Crushed Micro-Velvet & Royal Crepe',
    materials: 'Plush Crushed Micro-Velvet with Metallic Stud Mosaic Detailing',
    pattern: 'Swirling Wave Mosaic Studs',
    style: 'V-Neckline A-Line Velvet Gown with Studded Border Placket & Cuffs',
    colors: [{ name: 'Midnight Charcoal', hex: '#2F353B' }],
    tags: ['abaya', 'velvet abaya', 'crushed velvet', 'winter abaya', 'evening abaya', 'charcoal abaya', 'studded abaya'],
    careInstructions: 'Dry clean only to preserve crushed velvet pile and delicate metallic stud work. Steam lightly on reverse.',
    shortDescription: 'Regal midnight charcoal crushed micro-velvet abaya featuring luminous texture, intricate swirling metallic stud mosaic accents on the bodice, and matching cuff borders.',
    description: 'Embrace majestic opulence with the Midnight Charcoal Crushed Velvet Swirl Abaya. Cut from plush, heavy-drape micro-velvet that captures the light with a rich multidimensional luster, this statement gown is adorned with thousands of micro-metallic studs swirling across the upper bodice and wide cuff bands. Finished with a double-row studded center placket and a modest V-neck cut, making it the supreme choice for winter soirees, weddings, and evening receptions.',
    basePrice: 3199.00,
    salePrice: 2399.00,
    displayOrder: 11,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    seoTitle: 'Midnight Charcoal Crushed Velvet Swirl Abaya | Huma Collection',
    seoDescription: 'Buy luxury Midnight Charcoal Crushed Velvet Swirl Abaya with metallic stud mosaic work and rich drape at Huma Collection.',
  },
  {
    imageLocalPath: 'C:/Users/abdul/.gemini/antigravity/brain/0947e061-4d2a-4a2c-aef1-e69b8bd69f9a/.user_uploaded/media_1791828094521_cb63df40.jpg',
    name: 'Cascading Linear Beaded Black Abaya with Cuff Tassels',
    slug: 'cascading-linear-beaded-black-abaya-with-cuff-tassels',
    skuBase: 'HHC-ABY-012',
    fabric: 'Dubai Nida & Matte Royal Crepe',
    materials: 'High-Density Breathable Nida with Hand-Stitched Glass Bugle Beads & Silk Tassels',
    pattern: 'Vertical Linear Beading with Tassel Accents',
    style: 'Open/Closed Modest Robe with Keyhole Collar & Hanging Cuff Tassels',
    colors: [{ name: 'Jet Black', hex: '#0A0A0A' }],
    tags: ['abaya', 'black abaya', 'tassel abaya', 'beaded abaya', 'dubai abaya', 'linear beadwork', 'modest luxury'],
    careInstructions: 'Dry clean or gentle hand wash in cold water. Do not wring. Hang dry. Iron on low heat using pressing cloth.',
    shortDescription: 'Elegantly tailored black Dubai Nida abaya adorned with vertical columns of fine glass beadwork and playful, graceful hanging tassels on the sleeve cuffs.',
    description: 'Effortless grace meets artisan detail in our Cascading Linear Beaded Black Abaya. Crafted from fluid, matte Dubai Nida crepe, the bodice is framed with delicate vertical columns of reflective black and pewter bugle beads that cascade down the front to create an elongating silhouette. The wide bell sleeves are punctuated with hand-crafted hanging silk tassels that sway delicately with every gesture, adding whimsical sophistication to classic modesty.',
    basePrice: 2899.00,
    salePrice: 2199.00,
    displayOrder: 12,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    seoTitle: 'Cascading Linear Beaded Black Abaya with Cuff Tassels | Huma Collection',
    seoDescription: 'Order the elegant Cascading Linear Beaded Black Abaya with hanging cuff tassels in Dubai Nida fabric at Huma Collection.',
  },
  {
    imageLocalPath: 'C:/Users/abdul/.gemini/antigravity/brain/0947e061-4d2a-4a2c-aef1-e69b8bd69f9a/.user_uploaded/media_1791828094531_ec3fd735.jpg',
    name: 'Mulberry Plum Trench Collar Jacquard Abaya with Gold Clasp',
    slug: 'mulberry-plum-trench-collar-jacquard-abaya-gold-clasp',
    skuBase: 'HHC-ABY-013',
    fabric: 'Jacquard Textured Crinkled Crepe',
    materials: 'Tone-on-Tone Textured Poly-Silk Jacquard with Gold Metal Hardware Clasps',
    pattern: 'Subtle Crinkled Botanical Jacquard Weave',
    style: 'Trench Coat Collar Lapel with Gold Metal Chest Clasp & Cuff Tabs',
    colors: [{ name: 'Mulberry Plum', hex: '#6B4C5A' }],
    tags: ['abaya', 'plum abaya', 'jacquard abaya', 'trench abaya', 'coat abaya', 'gold clasp', 'executive modest', 'winter fashion'],
    careInstructions: 'Dry clean or machine wash cold on delicate cycle. Hang to dry. Steam iron on reverse.',
    shortDescription: 'Fashion-forward mulberry plum textured jacquard abaya featuring an overlapping trench coat collar, statement gold chest clasp, and tailored cuff tabs.',
    description: 'Redefining modest outerwear, the Mulberry Plum Trench Collar Jacquard Abaya combines runway tailoring with Islamic modesty. Spun from a rich tone-on-tone textured crinkled jacquard in a regal muted plum hue, this structured gown features wide crossover notched lapels secured by a prominent black leatherette strap with a gleaming gold buckle hardware clasp. Accented with geometric gold sleeve cuff tabs for a modern, executive edge.',
    basePrice: 2999.00,
    salePrice: 2299.00,
    displayOrder: 13,
    isFeatured: true,
    isBestseller: false,
    isNewArrival: true,
    seoTitle: 'Mulberry Plum Trench Collar Jacquard Abaya | Huma Collection',
    seoDescription: 'Shop the chic Mulberry Plum Trench Collar Jacquard Abaya with gold clasp hardware at Huma Collection.',
  },
  {
    imageLocalPath: 'C:/Users/abdul/.gemini/antigravity/brain/0947e061-4d2a-4a2c-aef1-e69b8bd69f9a/.user_uploaded/media_1791828094539_b3772ba9.jpg',
    name: 'Arabesque Swirl Embellished Black Evening Abaya',
    slug: 'arabesque-swirl-embellished-black-evening-abaya',
    skuBase: 'HHC-ABY-014',
    fabric: 'Premium Saudi Nida Matte Crepe',
    materials: 'Heavy Drape Saudi Nida with Bronze-Gold Stud & Faceted Bead Embroidery',
    pattern: 'Intricate Arabesque Floral Swirl Work',
    style: 'V-Neckline Front Placket A-Line Gown with Studded Border Cuffs',
    colors: [{ name: 'Obsidian Black', hex: '#0D0D0D' }],
    tags: ['abaya', 'black abaya', 'arabesque abaya', 'evening abaya', 'studded abaya', 'luxury modest', 'party abaya'],
    careInstructions: 'Dry clean recommended to protect intricate stud and crystal bead patterns. Steam iron on reverse.',
    shortDescription: 'Sumptuous obsidian black Saudi Nida abaya adorned with intricate Arabesque swirling stud and bead embroidery on the neckline, chest, and wide cuffs.',
    description: 'An ode to classical Middle Eastern craftsmanship, the Arabesque Swirl Embellished Black Evening Abaya is tailored from heavy-drape Saudi Nida that falls flawlessly without clinging. The chest and shoulders feature a lavish arabesque scroll motif rendered in fine metallic micro-studs and tonal crystal beads, echoed across the generous cuff borders and vertical front border. Exudes understated nobility and timeless modest charm.',
    basePrice: 3299.00,
    salePrice: 2499.00,
    displayOrder: 14,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    seoTitle: 'Arabesque Swirl Embellished Black Evening Abaya | Huma Collection',
    seoDescription: 'Discover the Arabesque Swirl Embellished Black Evening Abaya in Saudi Nida crepe at Huma Collection.',
  },
  {
    imageLocalPath: 'C:/Users/abdul/.gemini/antigravity/brain/0947e061-4d2a-4a2c-aef1-e69b8bd69f9a/.user_uploaded/media_1791828094553_292a730b.jpg',
    name: 'Royal Aubergine Jacquard Abaya with Triangle Gold Buttons',
    slug: 'royal-aubergine-jacquard-abaya-triangle-gold-buttons',
    skuBase: 'HHC-ABY-015',
    fabric: 'Embossed Tone-on-Tone Jacquard Crepe',
    materials: 'Premium Textured Poly-Silk Jacquard with Sculpted Triangular Gold Buttons',
    pattern: 'Organic Abstract Line Jacquard Texture',
    style: 'Front-Placket A-Line Abaya with Statement Geometric Buttons & Cuff Accents',
    colors: [{ name: 'Imperial Aubergine', hex: '#3B1F2B' }],
    tags: ['abaya', 'aubergine abaya', 'purple abaya', 'jacquard abaya', 'gold buttons', 'a-line abaya', 'formal modest'],
    careInstructions: 'Machine wash cold on delicate cycle or hand wash. Hang to dry in shade. Warm iron on reverse.',
    shortDescription: 'Regal imperial aubergine jacquard abaya featuring organic textured motifs, a clean V-neckline, and statement sculpted triangular gold-finished buttons.',
    description: 'Enrich your palette with the Royal Aubergine Jacquard Abaya. Cut from an exclusive textured jacquard weave in an alluring deep imperial aubergine, the fabric features an organic tone-on-tone vine relief that shimmers gently under sunlight. The front closure is crowned with bespoke geometric triangular gold-trimmed buttons running vertically down the center placket and repeated on the sleeve cuffs, blending contemporary jewelry accents with modest grace.',
    basePrice: 2699.00,
    salePrice: 1999.00,
    displayOrder: 15,
    isFeatured: true,
    isBestseller: false,
    isNewArrival: true,
    seoTitle: 'Royal Aubergine Jacquard Abaya with Triangle Gold Buttons | Huma Collection',
    seoDescription: 'Shop the Royal Aubergine Jacquard Abaya with sculpted triangular gold buttons at Huma Collection.',
  },
];

const SIZES_CONFIG = [
  { sizeStr: '52', attrValId: 2, stock: 15 },
  { sizeStr: '54', attrValId: 3, stock: 20 },
  { sizeStr: '56', attrValId: 4, stock: 18 },
  { sizeStr: '58', attrValId: 5, stock: 12 },
];

async function seedBatch3() {
  console.log('====================================================');
  console.log(' Starting Ingestion for Batch 3: 5 New Abaya Products');
  console.log('====================================================\n');

  const adminId = 1;
  const categoryId = 3; // Abaya
  const secondaryCatId = 1; // Burqa Collection

  for (const item of PRODUCTS_BATCH_3) {
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

      await conn.query('DELETE FROM product_images WHERE product_id = ?', [productId]);
      await conn.query(
        `INSERT INTO product_images (product_id, s3_key, s3_url, alt_text, sort_order, is_primary, view_type)
         VALUES (?, ?, ?, ?, 1, 1, 'FRONT')`,
        [productId, s3Key, s3Url, `${item.name} Front View`]
      );
      console.log(`Linked primary image in product_images.`);

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
  console.log(' All 5 Batch 3 Abaya products successfully ingested and live!');
  console.log('====================================================\n');
}

seedBatch3()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error seeding batch 3 abayas:', err);
    process.exit(1);
  });
