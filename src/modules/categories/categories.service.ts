import { query, withTransaction } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { AudienceScope, CategoryItem } from '../../types';

export interface CategoryFilters {
  audience?: string;
  parentId?: number | null | 'root';
  includeInactive?: boolean;
}

export interface CreateCategoryDTO {
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  audience?: AudienceScope;
  parentId?: number | null;
  displayOrder?: number;
  isActive?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface UpdateCategoryDTO extends Partial<CreateCategoryDTO> {}

export class CategoriesService {
  /**
   * Retrieves categories for storefront or admin.
   */
  static async getCategories(filters: CategoryFilters = {}): Promise<CategoryItem[]> {
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (!filters.includeInactive) {
      whereClauses.push('c.is_active = 1');
    }

    if (filters.audience) {
      const aud = filters.audience.toUpperCase();
      if (aud === 'MEN') {
        whereClauses.push("c.audience IN ('MEN', 'ALL')");
      } else if (aud === 'WOMEN') {
        whereClauses.push("c.audience IN ('WOMEN', 'ALL')");
      } else if (aud === 'ALL' || aud === 'COMMON' || aud === 'BOTH') {
        whereClauses.push("c.audience = 'ALL'");
      } else if (['MEN', 'WOMEN'].includes(aud)) {
        whereClauses.push('c.audience = ?');
        params.push(aud);
      }
    }

    if (filters.parentId === 'root') {
      whereClauses.push('c.parent_id IS NULL');
    } else if (filters.parentId !== undefined && filters.parentId !== null) {
      whereClauses.push('c.parent_id = ?');
      params.push(filters.parentId);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const categoriesRaw: any = await query(`
      SELECT
        c.id, c.parent_id, c.name, c.slug, c.description, c.image_url,
        c.audience, c.is_active, c.display_order, c.seo_title, c.seo_description,
        c.created_at, c.updated_at,
        p.name AS parent_name,
        (
          SELECT COUNT(DISTINCT pr.id) FROM products pr
          WHERE (pr.category_id = c.id OR pr.subcategory_id = c.id)
            AND pr.status = 'ACTIVE' AND pr.deleted_at IS NULL
        ) AS product_count
      FROM product_categories c
      LEFT JOIN product_categories p ON c.parent_id = p.id
      ${whereSql}
      ORDER BY c.display_order ASC, c.name ASC
    `, params);

    const categories: CategoryItem[] = categoriesRaw.map((c: any) => ({
      id: c.id,
      parentId: c.parent_id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.image_url,
      audience: (c.audience || 'WOMEN') as AudienceScope,
      isActive: Boolean(c.is_active),
      displayOrder: Number(c.display_order || 0),
      seoTitle: c.seo_title,
      seoDescription: c.seo_description,
      parentName: c.parent_name || null,
      productCount: Number(c.product_count || 0),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    return categories;
  }

  /**
   * Retrieves single category by slug, including its subcategories or parent.
   */
  static async getCategoryBySlug(slug: string): Promise<CategoryItem | null> {
    const categories: any = await query(`
      SELECT
        c.id, c.parent_id, c.name, c.slug, c.description, c.image_url,
        c.audience, c.is_active, c.display_order, c.seo_title, c.seo_description,
        c.created_at, c.updated_at,
        p.name AS parent_name,
        (
          SELECT COUNT(DISTINCT pr.id) FROM products pr
          WHERE (pr.category_id = c.id OR pr.subcategory_id = c.id)
            AND pr.status = 'ACTIVE' AND pr.deleted_at IS NULL
        ) AS product_count
      FROM product_categories c
      LEFT JOIN product_categories p ON c.parent_id = p.id
      WHERE c.slug = ?
    `, [slug]);

    if (!categories.length) {
      return null;
    }

    const c = categories[0];
    const category: CategoryItem = {
      id: c.id,
      parentId: c.parent_id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.image_url,
      audience: (c.audience || 'WOMEN') as AudienceScope,
      isActive: Boolean(c.is_active),
      displayOrder: Number(c.display_order || 0),
      seoTitle: c.seo_title,
      seoDescription: c.seo_description,
      parentName: c.parent_name || null,
      productCount: Number(c.product_count || 0),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };

    // Also fetch subcategories if any
    const subcats: any = await query(`
      SELECT
        c.id, c.parent_id, c.name, c.slug, c.description, c.image_url,
        c.audience, c.is_active, c.display_order,
        (
          SELECT COUNT(*) FROM products
          WHERE (category_id = c.id OR subcategory_id = c.id) AND status = 'ACTIVE' AND deleted_at IS NULL
        ) AS product_count
      FROM product_categories c
      WHERE c.parent_id = ? AND c.is_active = 1
      ORDER BY c.display_order ASC, c.name ASC
    `, [category.id]);

    category.subcategories = subcats.map((s: any) => ({
      id: s.id,
      parentId: s.parent_id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      imageUrl: s.image_url,
      audience: s.audience as AudienceScope,
      isActive: Boolean(s.is_active),
      displayOrder: Number(s.display_order || 0),
      productCount: Number(s.product_count || 0),
    }));

    return category;
  }

  /**
   * Retrieves single category by ID.
   */
  static async getCategoryById(id: number): Promise<CategoryItem | null> {
    const categories: any = await query(`
      SELECT
        c.id, c.parent_id, c.name, c.slug, c.description, c.image_url,
        c.audience, c.is_active, c.display_order, c.seo_title, c.seo_description,
        p.name AS parent_name
      FROM product_categories c
      LEFT JOIN product_categories p ON c.parent_id = p.id
      WHERE c.id = ?
    `, [id]);

    if (!categories.length) return null;
    const c = categories[0];
    return {
      id: c.id,
      parentId: c.parent_id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.image_url,
      audience: (c.audience || 'WOMEN') as AudienceScope,
      isActive: Boolean(c.is_active),
      displayOrder: Number(c.display_order || 0),
      seoTitle: c.seo_title,
      seoDescription: c.seo_description,
      parentName: c.parent_name || null,
    };
  }

  /**
   * Admin: Creates a new category.
   */
  static async adminCreateCategory(data: CreateCategoryDTO): Promise<CategoryItem> {
    // 1. Validate slug uniqueness
    const existing: any = await query('SELECT id FROM product_categories WHERE slug = ?', [data.slug]);
    if (existing.length > 0) {
      throw new AppError(`A category with slug '${data.slug}' already exists. Please choose a unique slug.`, 409, 'SLUG_CONFLICT');
    }

    // 2. Validate parent category if specified
    if (data.parentId) {
      const parent = await this.getCategoryById(data.parentId);
      if (!parent) {
        throw new AppError(`Parent category with ID ${data.parentId} does not exist`, 400, 'INVALID_PARENT');
      }
    }

    const res: any = await query(`
      INSERT INTO product_categories (
        name, slug, description, image_url, audience, parent_id,
        display_order, is_active, seo_title, seo_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.name.trim(),
      data.slug.trim().toLowerCase(),
      data.description || null,
      data.imageUrl || null,
      data.audience || 'WOMEN',
      data.parentId || null,
      data.displayOrder !== undefined ? data.displayOrder : 0,
      data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
      data.seoTitle || null,
      data.seoDescription || null,
    ]);

    const created = await this.getCategoryById(res.insertId);
    if (!created) {
      throw new AppError('Failed to retrieve newly created category', 500, 'CREATE_FAILED');
    }
    return created;
  }

  /**
   * Admin: Updates an existing category.
   */
  static async adminUpdateCategory(id: number, data: UpdateCategoryDTO): Promise<CategoryItem> {
    const existing = await this.getCategoryById(id);
    if (!existing) {
      throw new AppError(`Category with ID ${id} not found`, 404, 'NOT_FOUND');
    }

    // Validate slug uniqueness if slug changed
    if (data.slug && data.slug.trim().toLowerCase() !== existing.slug) {
      const slugCheck: any = await query('SELECT id FROM product_categories WHERE slug = ? AND id != ?', [data.slug.trim().toLowerCase(), id]);
      if (slugCheck.length > 0) {
        throw new AppError(`A category with slug '${data.slug}' already exists`, 409, 'SLUG_CONFLICT');
      }
    }

    // Validate parentId
    if (data.parentId !== undefined && data.parentId !== null) {
      if (data.parentId === id) {
        throw new AppError('A category cannot be its own parent', 400, 'CIRCULAR_PARENT');
      }
      const parent = await this.getCategoryById(data.parentId);
      if (!parent) {
        throw new AppError(`Parent category with ID ${data.parentId} does not exist`, 400, 'INVALID_PARENT');
      }
    }

    await query(`
      UPDATE product_categories SET
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        description = CASE WHEN ? = 1 THEN ? ELSE description END,
        image_url = CASE WHEN ? = 1 THEN ? ELSE image_url END,
        audience = COALESCE(?, audience),
        parent_id = CASE WHEN ? = 1 THEN ? ELSE parent_id END,
        display_order = COALESCE(?, display_order),
        is_active = CASE WHEN ? = 1 THEN ? ELSE is_active END,
        seo_title = CASE WHEN ? = 1 THEN ? ELSE seo_title END,
        seo_description = CASE WHEN ? = 1 THEN ? ELSE seo_description END
      WHERE id = ?
    `, [
      data.name ? data.name.trim() : null,
      data.slug ? data.slug.trim().toLowerCase() : null,
      data.description !== undefined ? 1 : 0, data.description || null,
      data.imageUrl !== undefined ? 1 : 0, data.imageUrl || null,
      data.audience || null,
      data.parentId !== undefined ? 1 : 0, data.parentId || null,
      data.displayOrder !== undefined ? data.displayOrder : null,
      data.isActive !== undefined ? (data.isActive ? 1 : 0) : null,
      data.seoTitle !== undefined ? 1 : 0, data.seoTitle || null,
      data.seoDescription !== undefined ? 1 : 0, data.seoDescription || null,
      id,
    ]);

    const updated = await this.getCategoryById(id);
    return updated!;
  }

  /**
   * Admin: Toggles is_active status of category.
   */
  static async adminUpdateStatus(id: number, isActive: boolean): Promise<void> {
    const existing = await this.getCategoryById(id);
    if (!existing) {
      throw new AppError(`Category with ID ${id} not found`, 404, 'NOT_FOUND');
    }
    await query('UPDATE product_categories SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  }

  /**
   * Admin: Deletes or archives category.
   */
  static async adminDeleteCategory(id: number): Promise<void> {
    const existing = await this.getCategoryById(id);
    if (!existing) {
      throw new AppError(`Category with ID ${id} not found`, 404, 'NOT_FOUND');
    }

    // Check if products exist in category
    const [prodCheck]: any = await query(
      'SELECT COUNT(*) as count FROM products WHERE (category_id = ? OR subcategory_id = ?) AND deleted_at IS NULL',
      [id, id]
    );

    if (prodCheck[0]?.count > 0) {
      throw new AppError(
        `Cannot delete category '${existing.name}' because it contains ${prodCheck[0].count} products. Move or delete these products first, or deactivate the category instead.`,
        400,
        'CATEGORY_IN_USE'
      );
    }

    await query('DELETE FROM product_categories WHERE id = ?', [id]);
  }

  /**
   * Retrieves products for a specific category.
   */
  static async getCategoryProducts(categoryId: number): Promise<any[]> {
    const products: any = await query(`
      SELECT
        p.id, p.name, p.slug, p.sku_base, p.base_price, p.sale_price,
        p.audience, p.status, p.is_featured, p.is_bestseller,
        (SELECT s3_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) AS primary_image_url
      FROM products p
      WHERE (p.category_id = ? OR p.subcategory_id = ?) AND p.deleted_at IS NULL
      ORDER BY p.display_order ASC, p.created_at DESC
    `, [categoryId, categoryId]);

    return products;
  }
}
