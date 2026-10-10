import { query, withTransaction } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { ProductItem } from '../../types';

export interface ProductFilterQuery {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  fabric?: string;
  style?: string;
  size?: string;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'bestseller';
  featuredOnly?: boolean;
}

export class ProductsService {
  /**
   * Retrieves paginated, filtered, and sorted products for customer catalog.
   */
  static async getProducts(filters: ProductFilterQuery): Promise<{
    products: any[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(filters.limit) || 12));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = ["p.status = 'ACTIVE'", 'p.deleted_at IS NULL'];
    const params: any[] = [];

    // Category filter
    if (filters.category) {
      whereClauses.push('c.slug = ?');
      params.push(filters.category);
    }

    // Fulltext search
    if (filters.search && filters.search.trim().length > 0) {
      whereClauses.push('(p.name LIKE ? OR p.short_description LIKE ? OR p.fabric LIKE ? OR p.sku_base LIKE ?)');
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term, term);
    }

    // Price range
    if (filters.minPrice !== undefined && !isNaN(filters.minPrice)) {
      whereClauses.push('p.base_price >= ?');
      params.push(filters.minPrice);
    }
    if (filters.maxPrice !== undefined && !isNaN(filters.maxPrice)) {
      whereClauses.push('p.base_price <= ?');
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
    let orderBy = 'p.created_at DESC';
    if (filters.sort === 'price_asc') {
      orderBy = 'COALESCE(p.sale_price, p.base_price) ASC';
    } else if (filters.sort === 'price_desc') {
      orderBy = 'COALESCE(p.sale_price, p.base_price) DESC';
    } else if (filters.sort === 'bestseller') {
      orderBy = 'p.is_bestseller DESC, p.created_at DESC';
    } else if (filters.sort === 'newest') {
      orderBy = 'p.created_at DESC';
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count query
    const countSql = `
      SELECT COUNT(DISTINCT p.id) AS total
      FROM products p
      JOIN product_categories c ON p.category_id = c.id
      ${whereSql}
    `;
    const countRes: any = await query(countSql, params);
    const total = countRes[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // Data query
    const dataSql = `
      SELECT
        p.id, p.category_id, c.name AS category_name, c.slug AS category_slug,
        p.name, p.slug, p.sku_base, p.short_description, p.fabric, p.pattern, p.style,
        p.base_price, p.sale_price, p.is_featured, p.is_bestseller, p.is_new_arrival,
        p.status, p.created_at,
        (
          SELECT s3_url FROM product_images
          WHERE product_id = p.id AND is_primary = 1
          LIMIT 1
        ) AS primary_image_url,
        (
          SELECT s3_url FROM product_images
          WHERE product_id = p.id AND is_primary = 0
          ORDER BY sort_order ASC LIMIT 1
        ) AS secondary_image_url,
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
      ${whereSql}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const products: any = await query(dataSql, [...params, limit, offset]);

    // Attach basic available sizes
    for (const prod of products) {
      const variants: any = await query(
        `SELECT pv.id, pv.sku, pv.price, pv.compare_at_price, pv.stock_quantity,
                pav.value AS size_value
         FROM product_variants pv
         LEFT JOIN product_variant_attributes pva ON pv.id = pva.variant_id
         LEFT JOIN product_attribute_values pav ON pva.attribute_value_id = pav.id AND pav.attribute_id = 1
         WHERE pv.product_id = ? AND pv.is_active = 1`,
        [prod.id]
      );
      prod.variants = variants;
    }

    // Format products with camelCase mappings while keeping snake_case
    const formattedProducts = products.map((prod: any) => ({
      ...prod,
      categoryId: prod.category_id,
      categoryName: prod.category_name,
      categorySlug: prod.category_slug,
      skuBase: prod.sku_base,
      shortDescription: prod.short_description,
      basePrice: parseFloat(prod.base_price || 0),
      salePrice: prod.sale_price ? parseFloat(prod.sale_price) : null,
      isFeatured: Boolean(prod.is_featured),
      isBestseller: Boolean(prod.is_bestseller),
      isNewArrival: Boolean(prod.is_new_arrival),
      primaryImageUrl: prod.primary_image_url,
      secondaryImageUrl: prod.secondary_image_url,
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
   * Retrieves single product by clean SEO slug with all variants and images.
   */
  static async getProductBySlug(slug: string): Promise<ProductItem> {
    const products: any = await query(
      `SELECT
        p.id, p.category_id, c.name AS category_name, c.slug AS category_slug,
        p.name, p.slug, p.sku_base, p.short_description, p.description,
        p.fabric, p.pattern, p.style, p.care_instructions,
        p.base_price, p.sale_price, p.is_featured, p.is_bestseller, p.is_new_arrival,
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
       WHERE p.slug = ? AND p.status = 'ACTIVE' AND p.deleted_at IS NULL`,
      [slug]
    );

    if (!products.length) {
      throw new AppError('Product not found or is currently unavailable', 404, 'NOT_FOUND');
    }

    const product = products[0];

    // Fetch images
    const images: any = await query(
      `SELECT id, product_id, s3_key, s3_url, alt_text, sort_order, is_primary
       FROM product_images
       WHERE product_id = ?
       ORDER BY is_primary DESC, sort_order ASC`,
      [product.id]
    );

    // Fetch variants with attribute details
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
      skuBase: product.sku_base,
      shortDescription: product.short_description,
      careInstructions: product.care_instructions,
      basePrice: parseFloat(product.base_price || 0),
      salePrice: product.sale_price ? parseFloat(product.sale_price) : null,
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
   * Retrieves related products in the same category.
   */
  static async getRelatedProducts(productId: number, categoryId: number, limit: number = 4): Promise<any[]> {
    return query(
      `SELECT p.id, p.name, p.slug, p.base_price, p.sale_price, p.fabric,
              (SELECT s3_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) AS primary_image_url
       FROM products p
       WHERE p.category_id = ? AND p.id != ? AND p.status = 'ACTIVE' AND p.deleted_at IS NULL
       ORDER BY p.is_bestseller DESC, p.created_at DESC
       LIMIT ?`,
      [categoryId, productId, limit]
    );
  }

  /**
   * Admin: Add new product with variants and initial inventory.
   */
  static async adminCreateProduct(data: any, adminId: number): Promise<any> {
    return withTransaction(async (conn) => {
      // Insert product
      const [res]: any = await conn.query(
        `INSERT INTO products (
          category_id, name, slug, sku_base, short_description, description,
          fabric, pattern, style, care_instructions, base_price, sale_price,
          is_featured, is_bestseller, is_new_arrival, status, seo_title, seo_description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.categoryId,
          data.name,
          data.slug,
          data.skuBase,
          data.shortDescription,
          data.description,
          data.fabric || null,
          data.pattern || null,
          data.style || null,
          data.careInstructions || null,
          data.basePrice,
          data.salePrice || null,
          data.isFeatured ? 1 : 0,
          data.isBestseller ? 1 : 0,
          data.isNewArrival ? 1 : 0,
          data.status || 'ACTIVE',
          data.seoTitle || null,
          data.seoDescription || null,
        ]
      );

      const productId = res.insertId;

      // Insert images
      if (Array.isArray(data.images)) {
        let sort = 1;
        for (const img of data.images) {
          await conn.query(
            `INSERT INTO product_images (product_id, s3_key, s3_url, alt_text, sort_order, is_primary)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [productId, img.s3Key || `products/${data.slug}/${sort}.webp`, img.s3Url, img.altText || data.name, sort, img.isPrimary ? 1 : 0]
          );
          sort++;
        }
      }

      // Insert variants
      if (Array.isArray(data.variants)) {
        for (const v of data.variants) {
          const [vRes]: any = await conn.query(
            `INSERT INTO product_variants (product_id, sku, price, compare_at_price, stock_quantity, low_stock_threshold, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [productId, v.sku, v.price, v.compareAtPrice || null, v.stockQuantity || 0, v.lowStockThreshold || 5]
          );
          const variantId = vRes.insertId;

          // Record inventory audit
          await conn.query(
            `INSERT INTO inventory_transactions (variant_id, transaction_type, quantity_change, previous_stock, current_stock, reference_type, notes, created_by_admin_id)
             VALUES (?, 'RESTOCK', ?, 0, ?, 'ADMIN_PRODUCT_CREATE', 'Initial stock on product creation', ?)`,
            [variantId, v.stockQuantity || 0, v.stockQuantity || 0, adminId]
          );
        }
      }

      // Record admin audit log
      await conn.query(
        `INSERT INTO admin_audit_logs (admin_id, action, resource_type, resource_id, new_values, ip_address)
         VALUES (?, 'CREATE_PRODUCT', 'PRODUCT', ?, ?, '127.0.0.1')`,
        [adminId, productId.toString(), JSON.stringify({ name: data.name, slug: data.slug })]
      );

      return { id: productId, name: data.name, slug: data.slug };
    });
  }

  /**
   * Admin: List products with search, category, and status filters.
   */
  static async adminGetProducts(queryParam: any): Promise<{ products: any[]; total: number }> {
    const page = Math.max(1, Number(queryParam.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(queryParam.limit) || 20));
    const offset = (page - 1) * limit;

    const where: string[] = ['p.deleted_at IS NULL'];
    const params: any[] = [];

    if (queryParam.category) {
      where.push('c.slug = ?');
      params.push(queryParam.category);
    }
    if (queryParam.status) {
      where.push('p.status = ?');
      params.push(queryParam.status);
    }
    if (queryParam.search) {
      where.push('(p.name LIKE ? OR p.sku_base LIKE ? OR p.fabric LIKE ?)');
      const term = `%${queryParam.search.trim()}%`;
      params.push(term, term, term);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const countRes: any = await query(`SELECT COUNT(*) as count FROM products p JOIN product_categories c ON p.category_id = c.id ${whereSql}`, params);
    const total = countRes[0]?.count || 0;

    const products: any = await query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug,
              (SELECT s3_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image_url,
              (SELECT COALESCE(SUM(stock_quantity), 0) FROM product_variants WHERE product_id = p.id AND is_active = 1) as total_stock,
              (SELECT COUNT(*) FROM product_variants WHERE product_id = p.id) as variant_count
       FROM products p
       JOIN product_categories c ON p.category_id = c.id
       ${whereSql}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { products, total };
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
   */
  static async adminDeleteProduct(productId: number, adminId: number): Promise<void> {
    await query('UPDATE products SET deleted_at = NOW(), status = \'ARCHIVED\' WHERE id = ?', [productId]);
    await query(
      `INSERT INTO admin_audit_logs (admin_id, action, resource_type, resource_id, ip_address)
       VALUES (?, 'DELETE_PRODUCT', 'PRODUCT', ?, '127.0.0.1')`,
      [adminId, productId.toString()]
    );
  }
}

