import { query } from '../../config/database';

export class CategoriesService {
  /**
   * Retrieves active product categories with product counts.
   */
  static async getCategories(): Promise<any[]> {
    const categories: any = await query(`
      SELECT
        c.id, c.parent_id, c.name, c.slug, c.description, c.image_url,
        c.display_order, c.seo_title, c.seo_description,
        (
          SELECT COUNT(*) FROM products
          WHERE category_id = c.id AND status = 'ACTIVE' AND deleted_at IS NULL
        ) AS product_count
      FROM product_categories c
      WHERE c.is_active = 1
      ORDER BY c.display_order ASC, c.name ASC
    `);

    return categories.map((c: any) => ({
      ...c,
      imageUrl: c.image_url,
      productCount: Number(c.product_count || 0),
    }));
  }


  /**
   * Retrieves single category by slug.
   */
  static async getCategoryBySlug(slug: string): Promise<any> {
    const categories: any = await query(
      `SELECT * FROM product_categories WHERE slug = ? AND is_active = 1`,
      [slug]
    );
    return categories[0] || null;
  }
}
