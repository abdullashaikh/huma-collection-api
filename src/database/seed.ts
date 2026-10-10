import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { logger } from '../config/logger';

async function seed() {
  logger.info('🌱 Starting database seeding for Huma Hijab Collection...');
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Roles
    await conn.query(`
      INSERT INTO roles (id, name, description) VALUES
      (1, 'SUPER_ADMIN', 'Full unrestricted enterprise store management'),
      (2, 'ADMIN', 'General administrative access'),
      (3, 'PRODUCT_MANAGER', 'Catalog, pricing, inventory and media control'),
      (4, 'ORDER_MANAGER', 'Order dispatch, shipping, returns and customer support')
      ON DUPLICATE KEY UPDATE description = VALUES(description);
    `);

    // 2. Permissions
    const permissions = [
      ['products:read', 'View Products', 'products'],
      ['products:write', 'Create and Edit Products', 'products'],
      ['products:delete', 'Delete/Archive Products', 'products'],
      ['inventory:read', 'View Inventory', 'inventory'],
      ['inventory:adjust', 'Adjust Stock Levels', 'inventory'],
      ['orders:read', 'View Orders', 'orders'],
      ['orders:update', 'Update Order Status & Dispatch', 'orders'],
      ['coupons:manage', 'Manage Discount Codes', 'coupons'],
      ['reviews:moderate', 'Moderate Customer Reviews', 'reviews'],
      ['media:upload', 'Upload Media Assets to S3', 'media'],
      ['banners:manage', 'Manage Homepage Banners', 'banners'],
      ['settings:manage', 'Update Store Settings', 'settings'],
      ['audit:read', 'View Admin Audit Logs', 'audit'],
    ];

    for (const [code, name, module] of permissions) {
      await conn.query(
        `INSERT INTO permissions (code, name, module) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), module = VALUES(module)`,
        [code, name, module]
      );
    }

    // Assign all permissions to SUPER_ADMIN
    await conn.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT 1, id FROM permissions;
    `);

    // 3. Super Admin User (admin@humahijabcollection.com / HumaAdmin@2026!)
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash('HumaAdmin@2026!', salt);

    await conn.query(
      `INSERT INTO admin_users (id, role_id, email, password_hash, first_name, last_name, phone, is_active)
       VALUES (1, 1, 'admin@humahijabcollection.com', ?, 'Fatima', 'Shaikh', '+919876543210', 1)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_active = 1`,
      [passwordHash]
    );

    // 4. Product Categories
    const categories = [
      {
        id: 1,
        name: 'Burqa Collection',
        slug: 'burqa',
        description: 'Exquisite, luxury modest burqas crafted from premium Korean crepe, Saudi chiffon, and Nida matte fabrics.',
        image_url: 'https://images.unsplash.com/photo-1584282479901-705a6104bc99?auto=format&fit=crop&w=800&q=80',
        display_order: 1,
        seo_title: 'Designer Burqa Collection | Huma Hijab Collection',
        seo_description: 'Explore the finest modest burqas. Elegant front-open, butterfly flare, and Dubai cut burqas with hand embroidery.',
      },
      {
        id: 2,
        name: 'Hijab',
        slug: 'hijab',
        description: 'Breathable, lightweight premium chiffon, Turkish silk satin, and jersey hijabs.',
        image_url: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=800&q=80',
        display_order: 2,
        seo_title: 'Premium Modest Hijabs | Huma Hijab Collection',
        seo_description: 'Shop luxury Turkish silk, modal, and everyday chiffon hijabs in graceful modest hues.',
      },
      {
        id: 3,
        name: 'Abaya',
        slug: 'abaya',
        description: 'Contemporary & classic modest abayas with fluid silhouettes and minimalist cuts.',
        image_url: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?auto=format&fit=crop&w=800&q=80',
        display_order: 3,
        seo_title: 'Luxury Abayas Online | Huma Hijab Collection',
        seo_description: 'Discover modern modest wear with our premium abaya collection.',
      },
      {
        id: 4,
        name: 'Niqab',
        slug: 'niqab',
        description: 'Ultra-breathable 1-layer, 2-layer, and 3-layer Saudi style niqabs with gentle tie-backs.',
        image_url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80',
        display_order: 4,
        seo_title: 'Breathable Saudi Niqabs | Huma Hijab Collection',
        seo_description: 'Shop soft, premium breathable niqabs designed for all-day comfort.',
      },
      {
        id: 5,
        name: 'Nospice',
        slug: 'nospice',
        description: 'Comfortable, skin-friendly nose pieces and modest face covers.',
        image_url: 'https://images.unsplash.com/photo-1584282479901-705a6104bc99?auto=format&fit=crop&w=800&q=80',
        display_order: 5,
        seo_title: 'Nospice & Face Covers | Huma Hijab Collection',
        seo_description: 'High-quality modest nospice essentials with soft cotton lining.',
      },
      {
        id: 6,
        name: 'Perfume & Attar',
        slug: 'perfume-attar',
        description: 'Non-alcoholic artisanal attars and concentrated perfume oils: Oud, Kasturi, Rose, Amber & Musk.',
        image_url: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80',
        display_order: 6,
        seo_title: 'Pure Non-Alcoholic Attar & Perfume | Huma Hijab Collection',
        seo_description: 'Long-lasting pure attars and luxury concentrated perfume oils without alcohol.',
      },
      {
        id: 7,
        name: 'Topi',
        slug: 'topi',
        description: 'Traditional handcrafted Omani, Turkish, and crochet Islamic prayer caps.',
        image_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80',
        display_order: 7,
        seo_title: 'Handcrafted Islamic Topi & Prayer Caps | Huma Hijab Collection',
        seo_description: 'Shop elegant handcrafted and embroidered prayer caps for men and boys.',
      },
      {
        id: 8,
        name: 'Janamaz',
        slug: 'janamaz',
        description: 'Orthopedic memory foam and plush velvet prayer mats for comfort in prayer.',
        image_url: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=800&q=80',
        display_order: 8,
        seo_title: 'Plush & Orthopedic Janamaz | Huma Hijab Collection',
        seo_description: 'Premium padded and velvet prayer mats with intricate Mihrab designs.',
      },
      {
        id: 9,
        name: 'Rumal',
        slug: 'rumal',
        description: 'Finely hemmed pure cotton and embroidered Islamic rumals.',
        image_url: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=800&q=80',
        display_order: 9,
        seo_title: 'Pure Cotton Rumal | Huma Hijab Collection',
        seo_description: 'Gentle on skin, absorbent pure cotton rumals.',
      },
      {
        id: 10,
        name: 'Hajj & Umrah',
        slug: 'hajj-umrah',
        description: 'Complete pilgrimage kit: 100% cotton Terry Ihram, anti-theft belts, unscented toiletries.',
        image_url: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&w=800&q=80',
        display_order: 10,
        seo_title: 'Hajj & Umrah Pilgrimage Essentials | Huma Hijab Collection',
        seo_description: 'High quality Ihram sets, belts, travel mats and essentials for sacred journey.',
      },
      {
        id: 11,
        name: 'Tasbih',
        slug: 'tasbih',
        description: 'Natural olive wood, semi-precious agate, and digital counter tasbihs.',
        image_url: 'https://images.unsplash.com/photo-1584282479901-705a6104bc99?auto=format&fit=crop&w=800&q=80',
        display_order: 11,
        seo_title: 'Handmade Tasbih Beads & Digital Counters | Huma Hijab Collection',
        seo_description: 'Traditional 33 and 99-bead tasbihs crafted from wood and natural stone.',
      },
      {
        id: 12,
        name: 'Miswak',
        slug: 'miswak',
        description: 'Fresh organic Peelu and Olive root miswaks vacuum-sealed for hygiene.',
        image_url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
        display_order: 12,
        seo_title: 'Fresh Organic Miswak | Huma Hijab Collection',
        seo_description: 'Natural toothbrush with natural antibacterial bristles, vacuum-packed.',
      },
    ];

    for (const cat of categories) {
      await conn.query(
        `INSERT INTO product_categories (id, name, slug, description, image_url, display_order, seo_title, seo_description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), image_url=VALUES(image_url),
         display_order=VALUES(display_order), seo_title=VALUES(seo_title), seo_description=VALUES(seo_description)`,
        [cat.id, cat.name, cat.slug, cat.description, cat.image_url, cat.display_order, cat.seo_title, cat.seo_description]
      );
    }

    // 5. Product Attributes & Values
    await conn.query(`
      INSERT INTO product_attributes (id, name) VALUES
      (1, 'Size'),
      (2, 'Color'),
      (3, 'Fabric')
      ON DUPLICATE KEY UPDATE name=VALUES(name);
    `);

    const attributeValues = [
      // Sizes (ID 1)
      [1, '50 (Height 4\'10" - 5\'0")', null],
      [1, '52 (Height 5\'1" - 5\'2")', null],
      [1, '54 (Height 5\'3" - 5\'4")', null],
      [1, '56 (Height 5\'5" - 5\'6")', null],
      [1, '58 (Height 5\'7" - 5\'8")', null],
      [1, '60 (Height 5\'9"+)', null],
      // Colors (ID 2)
      [2, 'Obsidian Black', '#0D0D0D'],
      [2, 'Midnight Navy', '#152238'],
      [2, 'Imperial Maroon', '#4A0E17'],
      [2, 'Emerald Green', '#0B3B24'],
      [2, 'Mocha Taupe', '#6B5448'],
      // Fabrics (ID 3)
      [3, 'Pure Korean Crepe', null],
      [3, 'Saudi Nida Matte', null],
      [3, 'Royal Chiffon', null],
      [3, 'Firdaus Georgette', null],
    ];

    for (const [attrId, val, hex] of attributeValues) {
      await conn.query(
        `INSERT IGNORE INTO product_attribute_values (attribute_id, value, color_hex)
         VALUES (?, ?, ?)`,
        [attrId, val, hex]
      );
    }

    // 6. Real Products (With primary focus on BURQA)
    const productsData = [
      {
        id: 1,
        category_id: 1,
        name: 'Royal Black Dubai Crepe Front Open Burqa',
        slug: 'royal-black-dubai-crepe-front-open-burqa',
        sku_base: 'HHC-BRQ-001',
        short_description: 'Luxurious front-open designer burqa tailored with authentic Dubai crepe, featuring hidden metallic press studs and elegant bell cuffs.',
        description: `Indulge in unmatched grace with our Royal Black Dubai Crepe Front Open Burqa. Expertly tailored in high-thread-count Korean-imported Dubai Crepe, this masterpiece offers exceptional drape and opacity without excessive weight. Designed with a modest mandarin collar, discreet front concealed snap buttons, and delicate cuff gathers. Perfect for both formal occasions and elevated daily modest wear. Includes a matching complimentary chiffon shayla scarf.`,
        fabric: 'Pure Korean Crepe',
        pattern: 'Solid Matte with Tone-on-Tone Piping',
        style: 'Front Open Abaya-Cut',
        care_instructions: 'Gentle machine wash cold with similar colors or dry clean. Low steam iron on reverse.',
        base_price: 3499.00,
        sale_price: 2799.00,
        is_featured: true,
        is_bestseller: true,
        is_new_arrival: false,
        status: 'ACTIVE',
        seo_title: 'Royal Black Dubai Crepe Front Open Burqa | Huma Hijab Collection',
        seo_description: 'Buy Royal Black Dubai Crepe Front Open Burqa online. Premium modest modest-wear crafted with Korean crepe and matching scarf.',
        images: [
          { s3_url: 'https://images.unsplash.com/photo-1584282479901-705a6104bc99?auto=format&fit=crop&w=1200&q=85', alt: 'Royal Black Dubai Crepe Front Open Burqa Front Angle', is_primary: true },
          { s3_url: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?auto=format&fit=crop&w=1200&q=85', alt: 'Royal Black Dubai Crepe Burqa Back and Drapes', is_primary: false },
          { s3_url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1200&q=85', alt: 'Royal Black Dubai Crepe Sleeve Details', is_primary: false },
        ],
        variants: [
          { sku: 'HHC-BRQ-001-52-BLK', size: '52 (Height 5\'1" - 5\'2")', color: 'Obsidian Black', price: 2799.00, compare_at: 3499.00, stock: 18 },
          { sku: 'HHC-BRQ-001-54-BLK', size: '54 (Height 5\'3" - 5\'4")', color: 'Obsidian Black', price: 2799.00, compare_at: 3499.00, stock: 24 },
          { sku: 'HHC-BRQ-001-56-BLK', size: '56 (Height 5\'5" - 5\'6")', color: 'Obsidian Black', price: 2799.00, compare_at: 3499.00, stock: 20 },
          { sku: 'HHC-BRQ-001-58-BLK', size: '58 (Height 5\'7" - 5\'8")', color: 'Obsidian Black', price: 2799.00, compare_at: 3499.00, stock: 12 },
        ]
      },
      {
        id: 2,
        category_id: 1,
        name: 'Emirati Hand-Embroidered Butterfly Flare Burqa',
        slug: 'emirati-hand-embroidered-butterfly-flare-burqa',
        sku_base: 'HHC-BRQ-002',
        short_description: 'Wide butterfly flare silhouette adorned with intricate golden zari threadwork along the cuffs and neckline.',
        description: `Epitomizing royalty, our Emirati Hand-Embroidered Butterfly Flare Burqa features an opulent 120-inch hem sweep. Handcrafted by master artisans with delicate champagne-gold Resham and Zari embroidery inspired by classic Arabian floral motifs. Made from ultra-breathable Saudi Nida Matte that flows effortlessly around your movement while maintaining complete modesty.`,
        fabric: 'Saudi Nida Matte',
        pattern: 'Hand Embroidered Gold Zari',
        style: 'Butterfly Flare',
        care_instructions: 'Dry clean recommended to preserve handcrafted metallic embroidery.',
        base_price: 4999.00,
        sale_price: 3999.00,
        is_featured: true,
        is_bestseller: true,
        is_new_arrival: true,
        status: 'ACTIVE',
        seo_title: 'Emirati Hand-Embroidered Butterfly Burqa | Huma Hijab Collection',
        seo_description: 'Exquisite hand-embroidered butterfly burqa with golden zari threadwork in breathable Nida matte.',
        images: [
          { s3_url: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?auto=format&fit=crop&w=1200&q=85', alt: 'Emirati Hand-Embroidered Butterfly Flare Burqa', is_primary: true },
          { s3_url: 'https://images.unsplash.com/photo-1584282479901-705a6104bc99?auto=format&fit=crop&w=1200&q=85', alt: 'Emirati Butterfly Burqa Embroidery Close-Up', is_primary: false },
        ],
        variants: [
          { sku: 'HHC-BRQ-002-54-BLK', size: '54 (Height 5\'3" - 5\'4")', color: 'Obsidian Black', price: 3999.00, compare_at: 4999.00, stock: 15 },
          { sku: 'HHC-BRQ-002-56-BLK', size: '56 (Height 5\'5" - 5\'6")', color: 'Obsidian Black', price: 3999.00, compare_at: 4999.00, stock: 14 },
          { sku: 'HHC-BRQ-002-58-BLK', size: '58 (Height 5\'7" - 5\'8")', color: 'Obsidian Black', price: 3999.00, compare_at: 4999.00, stock: 8 },
        ]
      },
      {
        id: 3,
        category_id: 1,
        name: 'Luxury Nida Matte Umbrella Cut Burqa',
        slug: 'luxury-nida-matte-umbrella-cut-burqa',
        sku_base: 'HHC-BRQ-003',
        short_description: 'Classic 360-degree umbrella flare cut in premium non-static Nida fabric with ribbed stretch cuffs for easy ablution (Wudu).',
        description: `Designed for everyday modesty without compromising on poise. The 360-degree umbrella cut creates a majestic cascading silhouette. Tailored with practical ribbed elastic cuffs that stay comfortably in place and roll up easily for wudu. Features two deep concealed side pockets to securely carry your phone and personal essentials.`,
        fabric: 'Saudi Nida Matte',
        pattern: 'Solid Minimalist',
        style: '360 Umbrella Cut',
        care_instructions: 'Machine wash warm, tumble dry gentle, hang to prevent creases.',
        base_price: 2999.00,
        sale_price: 2399.00,
        is_featured: false,
        is_bestseller: true,
        is_new_arrival: false,
        status: 'ACTIVE',
        seo_title: 'Luxury Nida Matte Umbrella Cut Burqa with Pockets | Huma Hijab Collection',
        seo_description: 'Buy premium umbrella flare burqa with wudu-friendly stretch cuffs and concealed phone pockets.',
        images: [
          { s3_url: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=1200&q=85', alt: 'Luxury Nida Matte Umbrella Cut Burqa', is_primary: true },
        ],
        variants: [
          { sku: 'HHC-BRQ-003-52-BLK', size: '52 (Height 5\'1" - 5\'2")', color: 'Obsidian Black', price: 2399.00, compare_at: 2999.00, stock: 25 },
          { sku: 'HHC-BRQ-003-54-BLK', size: '54 (Height 5\'3" - 5\'4")', color: 'Obsidian Black', price: 2399.00, compare_at: 2999.00, stock: 30 },
          { sku: 'HHC-BRQ-003-56-BLK', size: '56 (Height 5\'5" - 5\'6")', color: 'Obsidian Black', price: 2399.00, compare_at: 2999.00, stock: 20 },
        ]
      },
      {
        id: 4,
        category_id: 1,
        name: 'Imperial Maroon Velvet Bordered Crepe Burqa',
        slug: 'imperial-maroon-velvet-bordered-crepe-burqa',
        sku_base: 'HHC-BRQ-004',
        short_description: 'Rich deep maroon modest burqa accented with plush silk-velvet trims along the lapels and sleeves.',
        description: `For evening celebrations and festive gatherings, this Imperial Maroon burqa blends rich regal hues with pure Korean crepe comfort. The lapels and cuffs are framed in German micro-velvet, accented with micro-crystal hotfix studs that shimmer subtly under ambient lights.`,
        fabric: 'Pure Korean Crepe & Micro Velvet',
        pattern: 'Contrast Velvet Border',
        style: 'Front Open A-Line',
        care_instructions: 'Dry clean only.',
        base_price: 4299.00,
        sale_price: 3499.00,
        is_featured: true,
        is_bestseller: false,
        is_new_arrival: true,
        status: 'ACTIVE',
        seo_title: 'Imperial Maroon Velvet Bordered Burqa | Huma Hijab Collection',
        seo_description: 'Shop luxury maroon burqa with plush velvet accents and crystal details.',
        images: [
          { s3_url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=85', alt: 'Imperial Maroon Velvet Bordered Crepe Burqa', is_primary: true },
        ],
        variants: [
          { sku: 'HHC-BRQ-004-54-MRN', size: '54 (Height 5\'3" - 5\'4")', color: 'Imperial Maroon', price: 3499.00, compare_at: 4299.00, stock: 12 },
          { sku: 'HHC-BRQ-004-56-MRN', size: '56 (Height 5\'5" - 5\'6")', color: 'Imperial Maroon', price: 3499.00, compare_at: 4299.00, stock: 10 },
        ]
      },
      {
        id: 5,
        category_id: 2,
        name: 'Premium Turkish Chiffon Hijab - Soft Mocha',
        slug: 'premium-turkish-chiffon-hijab-soft-mocha',
        sku_base: 'HHC-HJB-001',
        short_description: 'Non-slip, opaque textured chiffon hijab with delicately rolled hand-stitched edges.',
        description: `Our signature Turkish Chiffon Hijab provides unmatched drape with zero transparency when folded. The subtle matte texture stays secure throughout the day without slipping. Measuring 185cm x 75cm, offering generous coverage for versatile styling.`,
        fabric: 'Royal Chiffon',
        pattern: 'Solid Neutral',
        style: 'Rectangular Maxi',
        care_instructions: 'Hand wash cold with mild detergent, hang dry.',
        base_price: 799.00,
        sale_price: 499.00,
        is_featured: true,
        is_bestseller: true,
        is_new_arrival: false,
        status: 'ACTIVE',
        seo_title: 'Premium Turkish Chiffon Hijab Soft Mocha | Huma Hijab Collection',
        seo_description: 'Best non-slip chiffon hijab in soft mocha brown. Generous size, opaque fold.',
        images: [
          { s3_url: 'https://images.unsplash.com/photo-1574634534894-89d7576c8259?auto=format&fit=crop&w=1200&q=85', alt: 'Premium Turkish Chiffon Hijab Soft Mocha', is_primary: true },
        ],
        variants: [
          { sku: 'HHC-HJB-001-STD-MCH', size: 'Standard (185x75cm)', color: 'Mocha Taupe', price: 499.00, compare_at: 799.00, stock: 50 },
        ]
      },
      {
        id: 6,
        category_id: 4,
        name: 'Three-Layer Breathable Saudi Niqab - Jet Black',
        slug: 'three-layer-breathable-saudi-niqab-jet-black',
        sku_base: 'HHC-NQB-001',
        short_description: 'Super-soft chiffon 3-layer Saudi niqab with silk headband tie for headache-free wear.',
        description: `Crafted from featherlight Saudi chiffon, this 3-layer niqab offers maximum coverage with uncompromised breathability. The front layer features a neat eye-opening cut that does not pinch, while the back layers drape gracefully over shoulders. Equipped with wide silk tie straps that eliminate temple pressure.`,
        fabric: 'Saudi Nida Matte',
        pattern: 'Solid',
        style: '3-Layer Tie Back',
        care_instructions: 'Hand wash gently.',
        base_price: 899.00,
        sale_price: 649.00,
        is_featured: false,
        is_bestseller: true,
        is_new_arrival: false,
        status: 'ACTIVE',
        seo_title: 'Three Layer Breathable Saudi Niqab Jet Black | Huma Hijab Collection',
        seo_description: 'Authentic 3-layer Saudi niqab with headache-free tie bands and featherlight fabric.',
        images: [
          { s3_url: 'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=1200&q=85', alt: 'Three-Layer Breathable Saudi Niqab', is_primary: true },
        ],
        variants: [
          { sku: 'HHC-NQB-001-STD-BLK', size: 'Standard Tie-Back', color: 'Obsidian Black', price: 649.00, compare_at: 899.00, stock: 45 },
        ]
      },
      {
        id: 7,
        category_id: 6,
        name: 'Oud Al-Huma Royal Concentrated Attar (12ml)',
        slug: 'oud-al-huma-royal-concentrated-attar-12ml',
        sku_base: 'HHC-ATR-001',
        short_description: '100% alcohol-free pure oil blend of Cambodian Oud, Taif Rose, and warm Cashmere Amber.',
        description: `Hand-blended by generational perfumers, Oud Al-Huma opens with vibrant notes of fresh Taif Rose, developing into a deep woody heart of aged Cambodian Agarwood, anchored by warm sensual amber and white musk. 100% pure perfume oil (Ittar) with 14+ hours of projection. Encased in a gold-plated crystal flacon with applicator wand.`,
        fabric: 'Pure Non-Alcoholic Oil',
        pattern: 'Artisanal Perfume Oil',
        style: '12ml Crystal Bottle',
        care_instructions: 'Store away from direct sunlight in cool dry place.',
        base_price: 1899.00,
        sale_price: 1399.00,
        is_featured: true,
        is_bestseller: true,
        is_new_arrival: true,
        status: 'ACTIVE',
        seo_title: 'Oud Al-Huma Royal Pure Non-Alcoholic Attar | Huma Hijab Collection',
        seo_description: 'Pure 12ml non-alcoholic Oud attar with Taif rose and amber notes in crystal bottle.',
        images: [
          { s3_url: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=1200&q=85', alt: 'Oud Al-Huma Royal Concentrated Attar Flacon', is_primary: true },
        ],
        variants: [
          { sku: 'HHC-ATR-001-12ML', size: '12ml Flacon', color: 'Golden Amber', price: 1399.00, compare_at: 1899.00, stock: 60 },
        ]
      },
      {
        id: 8,
        category_id: 8,
        name: 'Plush Velvet Orthopedic Padded Janamaz',
        slug: 'plush-velvet-orthopedic-padded-janamaz',
        sku_base: 'HHC-JNM-001',
        short_description: 'High-density memory foam prayer mat with anti-skid base for soothing knee and joint support.',
        description: `Transform your prayer experience with our Orthopedic Padded Janamaz. Engineered with 20mm high-density medical grade memory foam wrapped in ultra-soft royal velvet, relieving knee and joint strain during Sujood and prolonged Tashahhud. Features an anti-skid rubberized backing that stays flat on tiles and hardwood floors.`,
        fabric: 'High-Density Memory Foam',
        pattern: 'Arch Mihrab Jacquard',
        style: 'Extra Padded 120cm x 75cm',
        care_instructions: 'Spot clean with damp cloth, removable zipped outer cover machine washable.',
        base_price: 2499.00,
        sale_price: 1799.00,
        is_featured: true,
        is_bestseller: true,
        is_new_arrival: false,
        status: 'ACTIVE',
        seo_title: 'Orthopedic Padded Memory Foam Janamaz | Huma Hijab Collection',
        seo_description: 'Relieve knee pain during prayer with our 20mm thick velvet memory foam janamaz.',
        images: [
          { s3_url: 'https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&w=1200&q=85', alt: 'Plush Velvet Orthopedic Padded Janamaz', is_primary: true },
        ],
        variants: [
          { sku: 'HHC-JNM-001-STD-GRN', size: 'Standard (120x75cm)', color: 'Emerald Green', price: 1799.00, compare_at: 2499.00, stock: 35 },
          { sku: 'HHC-JNM-001-LRG-NVY', size: 'Large Padded', color: 'Midnight Navy', price: 1799.00, compare_at: 2499.00, stock: 25 },
        ]
      },
      {
        id: 9,
        category_id: 11,
        name: 'Handcrafted Olive Wood 99-Bead Tasbih',
        slug: 'handcrafted-olive-wood-99-bead-tasbih',
        sku_base: 'HHC-TSB-001',
        short_description: 'Smooth turned natural Jerusalem olive wood beads with traditional braided tassel.',
        description: `Each bead is lathe-turned from aged natural olive wood, giving off a gentle natural aroma and unique grain patterns that grow deeper with time. Strung on high-tensile braided nylon cord with division markers at 33 and 66, finished with a classic handcrafted Ottoman tassel.`,
        fabric: 'Natural Olive Wood',
        pattern: 'Wood Grain',
        style: '99-Bead 8mm',
        care_instructions: 'Wipe with soft dry cloth, occasionally polish with drops of mineral oil.',
        base_price: 999.00,
        sale_price: 699.00,
        is_featured: false,
        is_bestseller: true,
        is_new_arrival: false,
        status: 'ACTIVE',
        seo_title: 'Handcrafted Natural Olive Wood 99-Bead Tasbih | Huma Hijab Collection',
        seo_description: 'Traditional 99-bead tasbih crafted from fragrant olive wood with division markers.',
        images: [
          { s3_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=85', alt: 'Handcrafted Olive Wood 99-Bead Tasbih', is_primary: true },
        ],
        variants: [
          { sku: 'HHC-TSB-001-8MM', size: '99-Bead (8mm)', color: 'Natural Olive Wood', price: 699.00, compare_at: 999.00, stock: 80 },
        ]
      },
      {
        id: 10,
        category_id: 10,
        name: 'Deluxe Hajj & Umrah 100% Cotton Ihram Set',
        slug: 'deluxe-hajj-umrah-cotton-ihram-set',
        sku_base: 'HHC-HMR-001',
        short_description: 'Heavyweight 1400g combed pure absorbent cotton Ihram towels for comfortable pilgrimage.',
        description: `Compliant with Islamic Shariah requirements, this set includes two seamless 100% absorbent combed terry cotton towels (approx. 1400g total weight). Unbleached, ultra-absorbent, hypoallergenic, and thick enough to avoid translucence in sunlight. Comes in a dust-proof waterproof travel zip pouch.`,
        fabric: '100% Combed Terry Cotton',
        pattern: 'Seamless Pure White',
        style: '2-Piece Towel Set',
        care_instructions: 'Machine wash warm, tumble dry gentle.',
        base_price: 1999.00,
        sale_price: 1499.00,
        is_featured: true,
        is_bestseller: true,
        is_new_arrival: false,
        status: 'ACTIVE',
        seo_title: 'Deluxe Hajj & Umrah Cotton Ihram Set 1400g | Huma Hijab Collection',
        seo_description: 'Buy premium 1400g pure cotton Ihram towels for Hajj and Umrah with travel pouch.',
        images: [
          { s3_url: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&w=1200&q=85', alt: 'Deluxe Hajj & Umrah 100% Cotton Ihram Set', is_primary: true },
        ],
        variants: [
          { sku: 'HHC-HMR-001-1400G', size: '54 (Height 5\'3" - 5\'4")', color: 'Obsidian Black', price: 1499.00, compare_at: 1999.00, stock: 40 },
        ]
      }
    ];

    for (const p of productsData) {
      await conn.query(
        `INSERT INTO products (
          id, category_id, name, slug, sku_base, short_description, description,
          fabric, pattern, style, care_instructions, base_price, sale_price,
          is_featured, is_bestseller, is_new_arrival, status, seo_title, seo_description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name=VALUES(name), short_description=VALUES(short_description), description=VALUES(description),
          base_price=VALUES(base_price), sale_price=VALUES(sale_price), is_featured=VALUES(is_featured),
          is_bestseller=VALUES(is_bestseller), is_new_arrival=VALUES(is_new_arrival), status=VALUES(status)`,
        [
          p.id, p.category_id, p.name, p.slug, p.sku_base, p.short_description, p.description,
          p.fabric, p.pattern, p.style, p.care_instructions, p.base_price, p.sale_price,
          p.is_featured, p.is_bestseller, p.is_new_arrival, p.status, p.seo_title, p.seo_description
        ]
      );

      // Images
      let sortOrder = 1;
      for (const img of p.images) {
        await conn.query(
          `INSERT INTO product_images (product_id, s3_key, s3_url, alt_text, sort_order, is_primary)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE s3_url=VALUES(s3_url), alt_text=VALUES(alt_text)`,
          [p.id, `products/${p.slug}/${sortOrder}.webp`, img.s3_url, img.alt, sortOrder, img.is_primary ? 1 : 0]
        );
        sortOrder++;
      }

      // Variants
      for (const v of p.variants) {
        const [res]: any = await conn.query(
          `INSERT INTO product_variants (product_id, sku, price, compare_at_price, stock_quantity, low_stock_threshold, is_active)
           VALUES (?, ?, ?, ?, ?, 5, 1)
           ON DUPLICATE KEY UPDATE price=VALUES(price), compare_at_price=VALUES(compare_at_price), stock_quantity=VALUES(stock_quantity)`,
          [p.id, v.sku, v.price, v.compare_at, v.stock]
        );

        let variantId = res.insertId;
        if (!variantId) {
          const [rows]: any = await conn.query('SELECT id FROM product_variants WHERE sku = ?', [v.sku]);
          variantId = rows[0]?.id;
        }

        if (variantId) {
          // Link attributes
          const [sizeAttrVal]: any = await conn.query('SELECT id FROM product_attribute_values WHERE value = ?', [v.size]);
          if (sizeAttrVal.length > 0) {
            await conn.query(
              `INSERT IGNORE INTO product_variant_attributes (variant_id, attribute_value_id) VALUES (?, ?)`,
              [variantId, sizeAttrVal[0].id]
            );
          }
          const [colorAttrVal]: any = await conn.query('SELECT id FROM product_attribute_values WHERE value = ?', [v.color]);
          if (colorAttrVal.length > 0) {
            await conn.query(
              `INSERT IGNORE INTO product_variant_attributes (variant_id, attribute_value_id) VALUES (?, ?)`,
              [variantId, colorAttrVal[0].id]
            );
          }

          // Initial Inventory Ledger
          await conn.query(
            `INSERT INTO inventory_transactions (
              variant_id, transaction_type, quantity_change, previous_stock, current_stock, reference_type, notes, created_by_admin_id
            ) VALUES (?, 'RESTOCK', ?, 0, ?, 'INITIAL_SEED', 'Initial opening warehouse stock for launch', 1)`,
            [variantId, v.stock, v.stock]
          );
        }
      }
    }

    // 7. Shipping Zones & Methods
    await conn.query(`
      INSERT INTO shipping_zones (id, zone_name, description, pincode_pattern) VALUES
      (1, 'All India Express Zone', 'Standard nationwide courier coverage across all deliverable pincodes', '.*')
      ON DUPLICATE KEY UPDATE zone_name = VALUES(zone_name);
    `);

    await conn.query(`
      INSERT INTO shipping_methods (id, zone_id, method_name, base_charge, free_shipping_threshold, cod_available, cod_charge, estimated_days_min, estimated_days_max) VALUES
      (1, 1, 'Standard Insured Delivery', 99.00, 1499.00, 1, 50.00, 3, 6),
      (2, 1, 'Express Priority Courier', 199.00, 2999.00, 1, 50.00, 1, 3)
      ON DUPLICATE KEY UPDATE base_charge = VALUES(base_charge), free_shipping_threshold = VALUES(free_shipping_threshold);
    `);

    // 8. Coupons
    await conn.query(`
      INSERT INTO coupons (id, code, discount_type, discount_value, min_order_value, max_discount_amount, valid_from, valid_until, is_active) VALUES
      (1, 'WELCOME10', 'PERCENTAGE', 10.00, 999.00, 500.00, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 1),
      (2, 'BURQASPECIAL', 'PERCENTAGE', 15.00, 2499.00, 1000.00, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 1),
      (3, 'FLAT200', 'FIXED', 200.00, 1499.00, NULL, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 1)
      ON DUPLICATE KEY UPDATE discount_value = VALUES(discount_value), is_active = 1;
    `);

    // 9. Banners
    await conn.query(`
      INSERT INTO banners (id, title, subtitle, image_url, mobile_image_url, link_url, button_text, display_order, is_active) VALUES
      (1, 'Royal Burqa Collection 2026', 'Grace In Every Fold • Authentic Korean & Saudi Crepe Fabrics', 'https://images.unsplash.com/photo-1584282479901-705a6104bc99?auto=format&fit=crop&w=1600&q=85', 'https://images.unsplash.com/photo-1584282479901-705a6104bc99?auto=format&fit=crop&w=800&q=85', '/burqa', 'Explore Burqa Collection', 1, 1),
      (2, 'Artisanal Perfumes & Attars', 'Pure Concentrated Cambodian Oud & Taif Rose Essence', 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=1600&q=85', 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=85', '/perfume-attar', 'Shop Non-Alcoholic Attar', 2, 1)
      ON DUPLICATE KEY UPDATE title=VALUES(title), image_url=VALUES(image_url);
    `);

    // 10. Website Settings
    const settings = [
      ['store_name', 'Huma Hijab Collection', 'Store branding name'],
      ['tagline', 'The Essence of Modesty & Timeless Elegance', 'Store marketing tagline'],
      ['support_phone', '+91 98765 43210', 'Customer service phone number'],
      ['whatsapp_number', '+919876543210', 'Primary WhatsApp helpline for inquiries and orders'],
      ['support_email', 'support@humahijabcollection.com', 'Official customer support email'],
      ['store_address', 'Shop #14, Royal Modest Arcade, Main Market, Mumbai 400008, Maharashtra, India', 'Physical store location'],
      ['instagram_handle', '@humahijabcollection', 'Official Instagram profile handle'],
      ['free_shipping_threshold', '1499.00', 'Minimum order amount in INR for free standard shipping'],
      ['default_tax_percentage', '5.0', 'GST tax rate applicable on apparel'],
      ['cod_fee', '50.00', 'Additional fee for Cash on Delivery orders'],
      ['announcement_bar', '✨ Exclusive Launch Offer: Use code WELCOME10 for 10% OFF on all Burqas | Free Shipping above ₹1,499', 'Top header announcement message'],
    ];

    for (const [key, val, desc] of settings) {
      await conn.query(
        `INSERT INTO website_settings (setting_key, setting_value, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), description = VALUES(description)`,
        [key, val, desc]
      );
    }

    // 11. Customer Reviews
    await conn.query(`
      INSERT INTO reviews (product_id, customer_name, rating, title, comment, is_verified_purchase, status) VALUES
      (1, 'Ayesha Siddiqui', 5, 'Breathtaking quality and drape!', 'The Korean crepe is genuinely premium. It feels featherlight yet completely opaque. The matching shayla is also lovely.', 1, 'APPROVED'),
      (1, 'Zainab Khan', 5, 'Wore this for an event, received so many compliments', 'The stitching is flawless and the front snap buttons are very sturdy and invisible. Highly recommended.', 1, 'APPROVED'),
      (2, 'Shabana Parveen', 5, 'Golden embroidery is majestic', 'Real zari threadwork. The butterfly cut is so wide and modest. Huma Collection never disappoints.', 1, 'APPROVED')
      ON DUPLICATE KEY UPDATE rating = VALUES(rating);
    `);

    await conn.commit();
    logger.info('🎉 Seed data populated successfully with real Burqa & modest wear products!');
  } catch (err: any) {
    await conn.rollback();
    logger.error('❌ Seeding failed:', { error: err.message, stack: err.stack });
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

seed();
