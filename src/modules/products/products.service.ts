import { query, withTransaction } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { AudienceScope, ProductItem } from '../../types';
import { MediaService } from '../media/media.service';

export interface ProductFilterQuery {
  page?: number;
  limit?: number;
  category?: string;
  subcategory?: string;
  audience?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  fabric?: string;
  style?: string;
  size?: string;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'bestseller' | 'display_order';
  featuredOnly?: boolean;
}

export class ProductsService {
  /**
   * Retrieves paginated, filtered, and sorted products for customer catalog.
   * STRICT: Only published, active products whose categories are active.
   */
  static async getProducts(filters: ProductFilterQuery): Promise<{
    products: any[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(filters.limit) || 12));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [
      "p.status = 'ACTIVE'",
      'p.deleted_at IS NULL',
      'c.is_active = 1',
    ];
    const params: any[] = [];

    // Category filter (by slug or ID, including cross-category mappings)
    if (filters.category) {
      whereClauses.push(
        '(c.slug = ? OR c.id = ? OR p.id IN (SELECT pcm.product_id FROM product_category_mappings pcm JOIN product_categories c2 ON pcm.category_id = c2.id WHERE c2.slug = ? OR c2.id = ?))'
      );
      const catVal = filters.category;
      const catNum = isNaN(Number(catVal)) ? -1 : Number(catVal);
      params.push(catVal, catNum, catVal, catNum);
    }

    // Subcategory filter
    if (filters.subcategory) {
      whereClauses.push('(sub.slug = ? OR p.subcategory_id = ?)');
      params.push(filters.subcategory, isNaN(Number(filters.subcategory)) ? -1 : Number(filters.subcategory));
    }

    // Audience filter (Requirement 4: Common/Both items appear in applicable audience views)
    if (filters.audience) {
      const aud = filters.audience.toUpperCase();
      if (aud === 'MEN') {
        whereClauses.push("(p.audience IN ('MEN', 'ALL') OR c.audience IN ('MEN', 'ALL'))");
      } else if (aud === 'WOMEN') {
        whereClauses.push("(p.audience IN ('WOMEN', 'ALL') OR c.audience IN ('WOMEN', 'ALL'))");
      } else if (aud === 'ALL' || aud === 'COMMON' || aud === 'BOTH') {
        whereClauses.push("(p.audience = 'ALL' OR c.audience = 'ALL')");
      }
    }

    // Fulltext search
    if (filters.search && filters.search.trim().length > 0) {
      whereClauses.push('(p.name LIKE ? OR p.short_description LIKE ? OR p.fabric LIKE ? OR p.sku_base LIKE ?)');
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term, term);
    }

    // Price range
    if (filters.minPrice !== undefined && !isNaN(filters.minPrice)) {
      whereClauses.push('COALESCE(p.sale_price, p.base_price) >= ?');
      params.push(filters.minPrice);
    }
    if (filters.maxPrice !== undefined && !isNaN(filters.maxPrice)) {
      whereClauses.push('COALESCE(p.sale_price, p.base_price) <= ?');
      params.push(filters.maxPrice);
    }

    // Fabric filter
    if (filters.fabric) {
      whereClauses.push('p.fabric LIKE ?');
      params.push(`%${filters.fabric}%`);
    }

    // Style filter
    if (filters.style) {
      whereClauses.push('p.style LIKE ?');
      params.push(`%${filters.style}%`);
    }

    // Featured only
    if (filters.featuredOnly) {
      whereClauses.push('p.is_featured = 1');
    }

    // Sorting
    let orderBy = 'p.display_order ASC, p.created_at DESC';
    if (filters.sort === 'price_asc') {
      orderBy = 'COALESCE(p.sale_price, p.base_price) ASC';
    } else if (filters.sort === 'price_desc') {
      orderBy = 'COALESCE(p.sale_price, p.base_price) DESC';
    } else if (filters.sort === 'bestseller') {
      orderBy = 'p.is_bestseller DESC, p.created_at DESC';
    } else if (filters.sort === 'newest') {
      orderBy = 'p.created_at DESC';
    } else if (filters.sort === 'display_order') {
      orderBy = 'p.display_order ASC, p.created_at DESC';
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    // Count query
    const countSql = `
      SELECT COUNT(DISTINCT p.id) AS total
      FROM products p
      JOIN product_categories c ON p.category_id = c.id
      LEFT JOIN product_categories sub ON p.subcategory_id = sub.id
      ${whereSql}
    `;
    const countRes: any = await query(countSql, params);
    const total = countRes[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // Data query
    const dataSql = `
      SELECT
        p.id, p.category_id, p.subcategory_id, p.audience,
        c.name AS category_name, c.slug AS category_slug,
        sub.name AS subcategory_name, sub.slug AS subcategory_slug,
        p.name, p.slug, p.sku_base, p.short_description, p.fabric, p.materials, p.pattern, p.style,
        p.colors, p.tags, p.base_price, p.sale_price, p.display_order,
        p.is_featured, p.is_bestseller, p.is_new_arrival,
        p.status, p.created_at,
        COALESCE(
          (SELECT s3_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1),
          (SELECT s3_url FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC, id ASC LIMIT 1)
        ) AS primary_image_url,
        (
          SELECT s3_url FROM product_images
          WHERE product_id = p.id AND is_primary = 0
          ORDER BY sort_order ASC LIMIT 1
        ) AS secondary_image_url,
        (
          SELECT s3_url FROM product_images
          WHERE product_id = p.id AND (view_type = 'BACK' OR sort_order = 2)
          LIMIT 1
        ) AS back_image_url,
        (
          SELECT COALESCE(SUM(stock_quantity), 0) FROM product_variants
          WHERE product_id = p.id AND is_active = 1
        ) AS total_stock,
        (
          SELECT COALESCE(AVG(rating), 5) FROM reviews
          WHERE product_id = p.id AND status = 'APPROVED'
        ) AS average_rating,
        (
          SELECT COUNT(*) FROM reviews
          WHERE product_id = p.id AND status = 'APPROVED'
        ) AS review_count
      FROM products p
      JOIN product_categories c ON p.category_id = c.id
      LEFT JOIN product_categories sub ON p.subcategory_id = sub.id
      ${whereSql}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const products: any = await query(dataSql, [...params, limit, offset]);

    // Attach basic available sizes & images for rich display
    for (const prod of products) {
      const [variants, images]: any = await Promise.all([
        query(
          `SELECT pv.id, pv.sku, pv.price, pv.compare_at_price, pv.stock_quantity,
                  pav.value AS size_value
           FROM product_variants pv
           LEFT JOIN product_variant_attributes pva ON pv.id = pva.variant_id
           LEFT JOIN product_attribute_values pav ON pva.attribute_value_id = pav.id AND pav.attribute_id = 1
           WHERE pv.product_id = ? AND pv.is_active = 1`,
          [prod.id]
        ),
        query(
          `SELECT id, s3_key, s3_url, alt_text, sort_order, is_primary, view_type
           FROM product_images
           WHERE product_id = ?
           ORDER BY is_primary DESC, sort_order ASC`,
          [prod.id]
        ),
      ]);
      prod.variants = variants;
      prod.images = images.map((img: any) => ({
        id: img.id,
        productId: prod.id,
        s3Key: img.s3_key,
        s3Url: MediaService.formatMediaUrl(img.s3_url) || img.s3_url,
        altText: img.alt_text,
        sortOrder: img.sort_order,
        isPrimary: Boolean(img.is_primary),
        viewType: img.view_type || 'FRONT',
      }));
    }

    const formattedProducts = products.map((prod: any) => ({
      ...prod,
      categoryId: prod.category_id,
      categoryName: prod.category_name,
      categorySlug: prod.category_slug,
      subcategoryId: prod.subcategory_id,
      subcategoryName: prod.subcategory_name,
      subcategorySlug: prod.subcategory_slug,
      audience: prod.audience || 'WOMEN',
      skuBase: prod.sku_base,
      shortDescription: prod.short_description,
      basePrice: parseFloat(prod.base_price || 0),
      salePrice: prod.sale_price ? parseFloat(prod.sale_price) : null,
      displayOrder: Number(prod.display_order || 0),
      isFeatured: Boolean(prod.is_featured),
      isBestseller: Boolean(prod.is_bestseller),
      isNewArrival: Boolean(prod.is_new_arrival),
      primaryImageUrl: MediaService.formatMediaUrl(prod.primary_image_url) || prod.primary_image_url,
      primary_image_url: MediaService.formatMediaUrl(prod.primary_image_url) || prod.primary_image_url,
      secondaryImageUrl: MediaService.formatMediaUrl(prod.secondary_image_url) || prod.secondary_image_url,
      secondary_image_url: MediaService.formatMediaUrl(prod.secondary_image_url) || prod.secondary_image_url,
      backImageUrl: MediaService.formatMediaUrl(prod.back_image_url) || prod.back_image_url,
      back_image_url: MediaService.formatMediaUrl(prod.back_image_url) || prod.back_image_url,
      totalStock: Number(prod.total_stock || 0),
      averageRating: parseFloat(prod.average_rating || 5),
      reviewCount: Number(prod.review_count || 0),
    }));

    return {
      products: formattedProducts,
      meta: { page, limit, total, totalPages },
    };
  }

  /**
   * Retrieves single product by clean SEO slug with all variants and multi-view images.
   */
  static async getProductBySlug(slug: string): Promise<ProductItem> {
    const products: any = await query(
      `SELECT
        p.id, p.category_id, p.subcategory_id, p.audience,
        c.name AS category_name, c.slug AS category_slug,
        sub.name AS subcategory_name, sub.slug AS subcategory_slug,
        p.name, p.slug, p.sku_base, p.short_description, p.description,
        p.fabric, p.materials, p.pattern, p.style, p.colors, p.tags, p.care_instructions,
        p.base_price, p.sale_price, p.display_order,
        p.is_featured, p.is_bestseller, p.is_new_arrival,
        p.status, p.seo_title, p.seo_description, p.canonical_url,
        p.created_at, p.updated_at,
        (
          SELECT COALESCE(AVG(rating), 5) FROM reviews
          WHERE product_id = p.id AND status = 'APPROVED'
        ) AS average_rating,
        (
          SELECT COUNT(*) FROM reviews
          WHERE product_id = p.id AND status = 'APPROVED'
        ) AS review_count
       FROM products p
       JOIN product_categories c ON p.category_id = c.id
       LEFT JOIN product_categories sub ON p.subcategory_id = sub.id
       WHERE p.slug = ? AND p.status = 'ACTIVE' AND p.deleted_at IS NULL`,
      [slug]
    );

    if (!products.length) {
      throw new AppError('Product not found or is currently unpublished', 404, 'NOT_FOUND');
    }

    const product = products[0];

    // Fetch images with viewType
    const imagesRaw: any = await query(
      `SELECT id, product_id, s3_key, s3_url, alt_text, sort_order, is_primary, view_type
       FROM product_images
       WHERE product_id = ?
       ORDER BY is_primary DESC, sort_order ASC`,
      [product.id]
    );

    const images = imagesRaw.map((img: any) => ({
      id: img.id,
      productId: img.product_id,
      s3Key: img.s3_key,
      s3Url: MediaService.formatMediaUrl(img.s3_url) || img.s3_url,
      altText: img.alt_text,
      sortOrder: img.sort_order,
      isPrimary: Boolean(img.is_primary),
      viewType: img.view_type || 'FRONT',
    }));

    // Fetch variants
    const variantsRaw: any = await query(
      `SELECT pv.id, pv.product_id, pv.sku, pv.price, pv.compare_at_price,
              pv.stock_quantity, pv.low_stock_threshold, pv.weight_grams, pv.barcode, pv.is_active
       FROM product_variants pv
       WHERE pv.product_id = ? AND pv.is_active = 1`,
      [product.id]
    );

    const variants = [];
    for (const v of variantsRaw) {
      const attrs: any = await query(
        `SELECT pa.name AS attribute_name, pav.value, pav.color_hex
         FROM product_variant_attributes pva
         JOIN product_attribute_values pav ON pva.attribute_value_id = pav.id
         JOIN product_attributes pa ON pav.attribute_id = pa.id
         WHERE pva.variant_id = ?`,
        [v.id]
      );

      const attrMap: Record<string, string> = {};
      for (const a of attrs) {
        attrMap[a.attribute_name.toLowerCase()] = a.value;
      }

      variants.push({
        ...v,
        attributes: attrMap,
      });
    }

    return {
      ...product,
      categoryId: product.category_id,
      categoryName: product.category_name,
      categorySlug: product.category_slug,
      subcategoryId: product.subcategory_id,
      subcategoryName: product.subcategory_name,
      subcategorySlug: product.subcategory_slug,
      audience: product.audience || 'WOMEN',
      skuBase: product.sku_base,
      shortDescription: product.short_description,
      materials: product.materials,
      colors: typeof product.colors === 'string' ? JSON.parse(product.colors) : product.colors,
      tags: typeof product.tags === 'string' ? JSON.parse(product.tags) : product.tags,
      careInstructions: product.care_instructions,
      basePrice: parseFloat(product.base_price || 0),
      salePrice: product.sale_price ? parseFloat(product.sale_price) : null,
      displayOrder: Number(product.display_order || 0),
      isFeatured: Boolean(product.is_featured),
      isBestseller: Boolean(product.is_bestseller),
      isNewArrival: Boolean(product.is_new_arrival),
      seoTitle: product.seo_title,
      seoDescription: product.seo_description,
      canonicalUrl: product.canonical_url,
      images,
      variants,
      averageRating: parseFloat(product.average_rating) || 5,
      reviewCount: Number(product.review_count) || 0,
    };
  }

  /**
   * Retrieves related products in the same category or audience.
   */
  static async getRelatedProducts(productId: number, categoryId: number, limit: number = 4): Promise<any[]> {
    return query(
      `SELECT p.id, p.name, p.slug, p.base_price, p.sale_price, p.fabric, p.audience,
              COALESCE(
                (SELECT s3_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1),
                (SELECT s3_url FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC, id ASC LIMIT 1)
              ) AS primary_image_url
       FROM products p
       WHERE p.category_id = ? AND p.id != ? AND p.status = 'ACTIVE' AND p.deleted_at IS NULL
       ORDER BY p.is_bestseller DESC, p.created_at DESC
       LIMIT ?`,
      [categoryId, productId, limit]
    );
  }

  /**
   * Admin: List products with search, category, status, and audience filters.
   */
  static async adminGetProducts(queryParam: any): Promise<{ products: any[]; total: number }> {
    const page = Math.max(1, Number(queryParam.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(queryParam.limit) || 100));
    const offset = (page - 1) * limit;

    const where: string[] = ['p.deleted_at IS NULL'];
    const params: any[] = [];

    if (queryParam.category) {
      where.push(
        '(c.slug = ? OR c.id = ? OR p.id IN (SELECT pcm.product_id FROM product_category_mappings pcm JOIN product_categories c2 ON pcm.category_id = c2.id WHERE c2.slug = ? OR c2.id = ?))'
      );
      const catVal = queryParam.category;
      const catNum = isNaN(Number(catVal)) ? -1 : Number(catVal);
      params.push(catVal, catNum, catVal, catNum);
    }
    if (queryParam.status) {
      where.push('p.status = ?');
      params.push(queryParam.status);
    }
    if (queryParam.audience) {
      where.push('p.audience = ?');
      params.push(String(queryParam.audience).toUpperCase());
    }
    if (queryParam.search) {
      where.push('(p.name LIKE ? OR p.sku_base LIKE ? OR p.fabric LIKE ? OR p.slug LIKE ?)');
      const term = `%${queryParam.search.trim()}%`;
      params.push(term, term, term, term);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const countRes: any = await query(
      `SELECT COUNT(*) as count
       FROM products p
       JOIN product_categories c ON p.category_id = c.id
       LEFT JOIN product_categories sub ON p.subcategory_id = sub.id
       ${whereSql}`,
      params
    );
    const total = countRes[0]?.count || 0;

    const products: any = await query(
      `SELECT p.*,
              c.name as category_name, c.slug as category_slug,
              sub.name as subcategory_name, sub.slug as subcategory_slug,
              COALESCE(
                (SELECT s3_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1),
                (SELECT s3_url FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC, id ASC LIMIT 1)
              ) as primary_image_url,
              (SELECT COALESCE(SUM(stock_quantity), 0) FROM product_variants WHERE product_id = p.id AND is_active = 1) as total_stock,
              (SELECT COUNT(*) FROM product_variants WHERE product_id = p.id) as variant_count
       FROM products p
       JOIN product_categories c ON p.category_id = c.id
       LEFT JOIN product_categories sub ON p.subcategory_id = sub.id
       ${whereSql}
       ORDER BY p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Attach images and variants to each admin product
    for (const prod of products) {
      const images: any = await query(
        `SELECT id, s3_key, s3_url, alt_text, sort_order, is_primary, view_type
         FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC`,
        [prod.id]
      );
      prod.images = images.map((img: any) => ({
        id: img.id,
        s3Key: img.s3_key,
        s3Url: MediaService.formatMediaUrl(img.s3_url) || img.s3_url,
        altText: img.alt_text,
        sortOrder: img.sort_order,
        isPrimary: Boolean(img.is_primary),
        viewType: img.view_type || 'FRONT',
      }));
      prod.primary_image_url = MediaService.formatMediaUrl(prod.primary_image_url) || prod.primary_image_url;
      prod.primaryImageUrl = prod.primary_image_url;

      const variants: any = await query(
        `SELECT id, product_id, sku, price, compare_at_price, stock_quantity, low_stock_threshold, is_active
         FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY id ASC`,
        [prod.id]
      );
      prod.variants = variants.map((v: any) => ({
        id: v.id,
        productId: v.product_id,
        product_id: v.product_id,
        sku: v.sku,
        price: Number(v.price),
        compareAtPrice: v.compare_at_price ? Number(v.compare_at_price) : null,
        compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
        stockQuantity: Number(v.stock_quantity),
        stock_quantity: Number(v.stock_quantity),
        lowStockThreshold: Number(v.low_stock_threshold || 5),
        low_stock_threshold: Number(v.low_stock_threshold || 5),
        isActive: Boolean(v.is_active),
        is_active: v.is_active,
      }));
    }

    return { products, total };
  }

  /**
   * Admin: Add new product with variants, multi-view images, audience, and category mapping.
   */
  static async adminCreateProduct(data: any, adminId: number): Promise<any> {
    const cleanSlug = data.slug.trim().toLowerCase();
    const cleanSkuBase = data.skuBase.trim().toUpperCase();

    // 1. Check slug & skuBase uniqueness against active products
    const slugExists: any = await query('SELECT id FROM products WHERE slug = ? AND deleted_at IS NULL', [cleanSlug]);
    if (slugExists.length > 0) {
      throw new AppError(`A product with slug '${data.slug}' already exists`, 409, 'SLUG_CONFLICT');
    }

    const skuExists: any = await query('SELECT id FROM products WHERE sku_base = ? AND deleted_at IS NULL', [cleanSkuBase]);
    if (skuExists.length > 0) {
      throw new AppError(`A product with SKU Base '${data.skuBase}' already exists`, 409, 'SKU_CONFLICT');
    }

    // 2. Clear any soft-deleted products that might be holding this slug or SKU base
    const deletedConflicts: any = await query(
      'SELECT id FROM products WHERE (slug = ? OR sku_base = ?) AND deleted_at IS NOT NULL',
      [cleanSlug, cleanSkuBase]
    );
    if (deletedConflicts.length > 0) {
      for (const d of deletedConflicts) {
        await query(
          'UPDATE products SET slug = CONCAT(slug, "-del-", ?), sku_base = CONCAT(sku_base, "-DEL-", ?) WHERE id = ?',
          [Date.now(), Date.now(), d.id]
        );
        await query(
          'UPDATE product_variants SET is_active = 0, sku = CONCAT(sku, "-DEL-", ?) WHERE product_id = ?',
          [Date.now(), d.id]
        );
      }
    }

    // 3. Clear soft-deleted variant SKUs
    if (Array.isArray(data.variants)) {
      for (const v of data.variants) {
        if (v.sku) {
          const vSku = v.sku.trim();
          const delVars: any = await query(
            'SELECT pv.id FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.sku = ? AND p.deleted_at IS NOT NULL',
            [vSku]
          );
          for (const dv of delVars) {
            await query(
              'UPDATE product_variants SET is_active = 0, sku = CONCAT(sku, "-DEL-", ?) WHERE id = ?',
              [Date.now(), dv.id]
            );
          }
        }
      }
    }

    return withTransaction(async (conn) => {
      // 2. Insert product record
      const [res]: any = await conn.query(
        `INSERT INTO products (
          category_id, subcategory_id, audience, name, slug, sku_base, short_description, description,
          fabric, materials, pattern, style, colors, tags, care_instructions, base_price, sale_price,
          display_order, is_featured, is_bestseller, is_new_arrival, status, seo_title, seo_description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.categoryId,
          data.subcategoryId || null,
          data.audience || 'WOMEN',
          data.name.trim(),
          data.slug.trim().toLowerCase(),
          data.skuBase.trim().toUpperCase(),
          data.shortDescription,
          data.description,
          data.fabric || null,
          data.materials || null,
          data.pattern || null,
          data.style || null,
          data.colors ? JSON.stringify(data.colors) : null,
          data.tags ? JSON.stringify(data.tags) : null,
          data.careInstructions || null,
          data.basePrice,
          data.salePrice || null,
          data.displayOrder !== undefined ? data.displayOrder : 0,
          data.isFeatured ? 1 : 0,
          data.isBestseller ? 1 : 0,
          data.isNewArrival ? 1 : 0,
          data.status || 'ACTIVE',
          data.seoTitle || null,
          data.seoDescription || null,
        ]
      );

      const productId = res.insertId;

      // 3. Insert primary category mapping
      await conn.query(
        `INSERT IGNORE INTO product_category_mappings (product_id, category_id, is_primary) VALUES (?, ?, 1)`,
        [productId, data.categoryId]
      );
      if (data.subcategoryId) {
        await conn.query(
          `INSERT IGNORE INTO product_category_mappings (product_id, category_id, is_primary) VALUES (?, ?, 0)`,
          [productId, data.subcategoryId]
        );
      }

      // 4. Insert multi-view images
      if (Array.isArray(data.images) && data.images.length > 0) {
        let sort = 1;
        for (const img of data.images) {
          await conn.query(
            `INSERT INTO product_images (product_id, s3_key, s3_url, alt_text, sort_order, is_primary, view_type)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              productId,
              img.s3Key || `products/${data.slug}/${sort}.webp`,
              img.s3Url,
              img.altText || data.name,
              img.sortOrder || sort,
              img.isPrimary ? 1 : 0,
              img.viewType || (sort === 1 ? 'FRONT' : sort === 2 ? 'BACK' : 'DETAIL'),
            ]
          );
          sort++;
        }
      }

      // 5. Insert variants
      if (Array.isArray(data.variants) && data.variants.length > 0) {
        for (const v of data.variants) {
          const [vRes]: any = await conn.query(
            `INSERT INTO product_variants (product_id, sku, price, compare_at_price, stock_quantity, low_stock_threshold, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [productId, v.sku, v.price, v.compareAtPrice || null, v.stockQuantity || 0, v.lowStockThreshold || 5]
          );
          const variantId = vRes.insertId;

          // Record initial inventory
          await conn.query(
            `INSERT INTO inventory_transactions (variant_id, transaction_type, quantity_change, previous_stock, current_stock, reference_type, notes, created_by_admin_id)
             VALUES (?, 'RESTOCK', ?, 0, ?, 'ADMIN_PRODUCT_CREATE', 'Initial stock on product creation', ?)`,
            [variantId, v.stockQuantity || 0, v.stockQuantity || 0, adminId]
          );
        }
      }

      // 6. Record admin audit log
      await conn.query(
        `INSERT INTO admin_audit_logs (admin_id, action, resource_type, resource_id, new_values, ip_address)
         VALUES (?, 'CREATE_PRODUCT', 'PRODUCT', ?, ?, '127.0.0.1')`,
        [adminId, productId.toString(), JSON.stringify({ name: data.name, slug: data.slug, audience: data.audience })]
      );

      return { id: productId, name: data.name, slug: data.slug };
    });
  }

  /**
   * Admin: Update product details, images, and variants.
   */
  static async adminUpdateProduct(productId: number, data: any, adminId: number): Promise<any> {
    const existing: any = await query('SELECT * FROM products WHERE id = ? AND deleted_at IS NULL', [productId]);
    if (!existing.length) {
      throw new AppError(`Product with ID ${productId} not found`, 404, 'NOT_FOUND');
    }

    if (data.slug && data.slug.trim().toLowerCase() !== existing[0].slug) {
      const slugCheck: any = await query('SELECT id FROM products WHERE slug = ? AND id != ? AND deleted_at IS NULL', [data.slug.trim().toLowerCase(), productId]);
      if (slugCheck.length > 0) {
        throw new AppError(`A product with slug '${data.slug}' already exists`, 409, 'SLUG_CONFLICT');
      }
    }

    return withTransaction(async (conn) => {
      // Update product fields
      await conn.query(`
        UPDATE products SET
          category_id = COALESCE(?, category_id),
          subcategory_id = CASE WHEN ? = 1 THEN ? ELSE subcategory_id END,
          audience = COALESCE(?, audience),
          name = COALESCE(?, name),
          slug = COALESCE(?, slug),
          sku_base = COALESCE(?, sku_base),
          short_description = COALESCE(?, short_description),
          description = COALESCE(?, description),
          fabric = CASE WHEN ? = 1 THEN ? ELSE fabric END,
          materials = CASE WHEN ? = 1 THEN ? ELSE materials END,
          pattern = CASE WHEN ? = 1 THEN ? ELSE pattern END,
          style = CASE WHEN ? = 1 THEN ? ELSE style END,
          colors = CASE WHEN ? = 1 THEN ? ELSE colors END,
          tags = CASE WHEN ? = 1 THEN ? ELSE tags END,
          care_instructions = CASE WHEN ? = 1 THEN ? ELSE care_instructions END,
          base_price = COALESCE(?, base_price),
          sale_price = CASE WHEN ? = 1 THEN ? ELSE sale_price END,
          display_order = COALESCE(?, display_order),
          is_featured = CASE WHEN ? = 1 THEN ? ELSE is_featured END,
          is_bestseller = CASE WHEN ? = 1 THEN ? ELSE is_bestseller END,
          is_new_arrival = CASE WHEN ? = 1 THEN ? ELSE is_new_arrival END,
          status = COALESCE(?, status),
          seo_title = CASE WHEN ? = 1 THEN ? ELSE seo_title END,
          seo_description = CASE WHEN ? = 1 THEN ? ELSE seo_description END,
          updated_at = NOW()
        WHERE id = ?
      `, [
        data.categoryId || null,
        data.subcategoryId !== undefined ? 1 : 0, data.subcategoryId || null,
        data.audience || null,
        data.name ? data.name.trim() : null,
        data.slug ? data.slug.trim().toLowerCase() : null,
        data.skuBase ? data.skuBase.trim().toUpperCase() : null,
        data.shortDescription || null,
        data.description || null,
        data.fabric !== undefined ? 1 : 0, data.fabric || null,
        data.materials !== undefined ? 1 : 0, data.materials || null,
        data.pattern !== undefined ? 1 : 0, data.pattern || null,
        data.style !== undefined ? 1 : 0, data.style || null,
        data.colors !== undefined ? 1 : 0, data.colors ? JSON.stringify(data.colors) : null,
        data.tags !== undefined ? 1 : 0, data.tags ? JSON.stringify(data.tags) : null,
        data.careInstructions !== undefined ? 1 : 0, data.careInstructions || null,
        data.basePrice !== undefined ? data.basePrice : null,
        data.salePrice !== undefined ? 1 : 0, data.salePrice || null,
        data.displayOrder !== undefined ? data.displayOrder : null,
        data.isFeatured !== undefined ? 1 : 0, data.isFeatured ? 1 : 0,
        data.isBestseller !== undefined ? 1 : 0, data.isBestseller ? 1 : 0,
        data.isNewArrival !== undefined ? 1 : 0, data.isNewArrival ? 1 : 0,
        data.status || null,
        data.seoTitle !== undefined ? 1 : 0, data.seoTitle || null,
        data.seoDescription !== undefined ? 1 : 0, data.seoDescription || null,
        productId,
      ]);

      // Update category mapping
      if (data.categoryId) {
        await conn.query('DELETE FROM product_category_mappings WHERE product_id = ?', [productId]);
        await conn.query('INSERT INTO product_category_mappings (product_id, category_id, is_primary) VALUES (?, ?, 1)', [productId, data.categoryId]);
        if (data.subcategoryId) {
          await conn.query('INSERT INTO product_category_mappings (product_id, category_id, is_primary) VALUES (?, ?, 0)', [productId, data.subcategoryId]);
        }
      }

      // Update images if provided
      if (Array.isArray(data.images) && data.images.length > 0) {
        await conn.query('DELETE FROM product_images WHERE product_id = ?', [productId]);
        let sort = 1;
        for (const img of data.images) {
          await conn.query(
            `INSERT INTO product_images (product_id, s3_key, s3_url, alt_text, sort_order, is_primary, view_type)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              productId,
              img.s3Key || `products/${data.slug || existing[0].slug}/${sort}.webp`,
              img.s3Url,
              img.altText || data.name || existing[0].name,
              img.sortOrder || sort,
              img.isPrimary ? 1 : 0,
              img.viewType || (sort === 1 ? 'FRONT' : sort === 2 ? 'BACK' : 'DETAIL'),
            ]
          );
          sort++;
        }
      }

      // Update variants if provided
      if (Array.isArray(data.variants) && data.variants.length > 0) {
        const keptVariantIds: number[] = [];
        for (const v of data.variants) {
          const vSku = (v.sku || '').trim();
          if (!vSku) continue;

          // Clear any soft-deleted variants with this SKU
          const delVars: any = await conn.query(
            'SELECT pv.id FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.sku = ? AND p.deleted_at IS NOT NULL',
            [vSku]
          );
          if (delVars[0]?.length > 0) {
            for (const dv of delVars[0]) {
              await conn.query(
                'UPDATE product_variants SET is_active = 0, sku = CONCAT(sku, "-DEL-", ?) WHERE id = ?',
                [Date.now(), dv.id]
              );
            }
          }

          if (v.id) {
            await conn.query(
              `UPDATE product_variants SET sku = ?, price = ?, compare_at_price = ?, stock_quantity = ?, low_stock_threshold = ?, is_active = 1
               WHERE id = ? AND product_id = ?`,
              [vSku, v.price, v.compareAtPrice || null, v.stockQuantity || 0, v.lowStockThreshold || 5, v.id, productId]
            );
            keptVariantIds.push(v.id);
          } else {
            const [insRes]: any = await conn.query(
              `INSERT INTO product_variants (product_id, sku, price, compare_at_price, stock_quantity, low_stock_threshold, is_active)
               VALUES (?, ?, ?, ?, ?, ?, 1)`,
              [productId, vSku, v.price, v.compareAtPrice || null, v.stockQuantity || 0, v.lowStockThreshold || 5]
            );
            keptVariantIds.push(insRes.insertId);
          }
        }

        if (keptVariantIds.length > 0) {
          // Deactivate variants removed from product
          await conn.query(
            `UPDATE product_variants SET is_active = 0 WHERE product_id = ? AND id NOT IN (?)`,
            [productId, keptVariantIds]
          );
        }
      }

      await conn.query(
        `INSERT INTO admin_audit_logs (admin_id, action, resource_type, resource_id, new_values, ip_address)
         VALUES (?, 'UPDATE_PRODUCT', 'PRODUCT', ?, ?, '127.0.0.1')`,
        [adminId, productId.toString(), JSON.stringify({ name: data.name, audience: data.audience, status: data.status })]
      );

      return { id: productId };
    });
  }

  /**
   * Admin: Update product status (ACTIVE, DRAFT, ARCHIVED).
   */
  static async adminUpdateStatus(productId: number, status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED', adminId: number): Promise<void> {
    await query('UPDATE products SET status = ?, updated_at = NOW() WHERE id = ?', [status, productId]);
    await query(
      `INSERT INTO admin_audit_logs (admin_id, action, resource_type, resource_id, new_values, ip_address)
       VALUES (?, 'UPDATE_PRODUCT_STATUS', 'PRODUCT', ?, ?, '127.0.0.1')`,
      [adminId, productId.toString(), JSON.stringify({ status })]
    );
  }

  /**
   * Admin: Soft-delete product.
   * Frees up slug and SKU so same name/SKU can be re-created without unique key collision.
   */
  static async adminDeleteProduct(productId: number, adminId: number): Promise<void> {
    const ts = Date.now();
    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE products 
         SET deleted_at = NOW(), 
             status = 'ARCHIVED',
             slug = CONCAT(slug, '-del-', ?),
             sku_base = CONCAT(sku_base, '-DEL-', ?)
         WHERE id = ?`,
        [ts, ts, productId]
      );
      await conn.query(
        `UPDATE product_variants 
         SET is_active = 0,
             sku = CONCAT(sku, '-DEL-', ?)
         WHERE product_id = ?`,
        [ts, productId]
      );
      await conn.query(
        `INSERT INTO admin_audit_logs (admin_id, action, resource_type, resource_id, ip_address)
         VALUES (?, 'DELETE_PRODUCT', 'PRODUCT', ?, '127.0.0.1')`,
        [adminId, productId.toString()]
      );
    });
  }
}
