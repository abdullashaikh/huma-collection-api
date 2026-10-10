import { query, withTransaction } from '../../config/database';
import { AppError } from '../../middleware/error-handler';

export class AdminDashboardService {

  /**
   * Computes key metrics and charts for the Admin Overview dashboard.
   */
  static async getStats(): Promise<any> {
    // 1. Total Revenue
    const revenueRes: any = await query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total_revenue
       FROM orders
       WHERE payment_status = 'PAID'`
    );
    const totalRevenue = parseFloat(revenueRes[0]?.total_revenue || 0);

    // 2. Orders Count
    const orderCountRes: any = await query('SELECT COUNT(*) AS total_orders FROM orders');
    const totalOrders = orderCountRes[0]?.total_orders || 0;

    // 3. Products Count
    const prodCountRes: any = await query(
      "SELECT COUNT(*) AS total_products FROM products WHERE status = 'ACTIVE' AND deleted_at IS NULL"
    );
    const totalProducts = prodCountRes[0]?.total_products || 0;

    // 4. Low Stock Variants Count
    const lowStockRes: any = await query(
      'SELECT COUNT(*) AS low_stock FROM product_variants WHERE stock_quantity <= low_stock_threshold AND is_active = 1'
    );
    const lowStockCount = lowStockRes[0]?.low_stock || 0;

    // 5. Recent Orders (Top 6)
    const recentOrders: any = await query(
      `SELECT id, order_number, customer_name, customer_phone, total_amount,
              order_status, payment_status, payment_method, created_at
       FROM orders
       ORDER BY created_at DESC
       LIMIT 6`
    );

    // 6. Low Stock Inventory Alert List
    const lowStockList: any = await query(
      `SELECT pv.id, pv.sku, pv.stock_quantity, pv.low_stock_threshold,
              p.name AS product_name, p.slug AS product_slug
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       WHERE pv.stock_quantity <= pv.low_stock_threshold AND pv.is_active = 1
       ORDER BY pv.stock_quantity ASC
       LIMIT 5`
    );

    // 7. Orders Breakdown by Status
    const statusBreakdown: any = await query(
      `SELECT order_status, COUNT(*) AS count
       FROM orders
       GROUP BY order_status`
    );

    return {
      kpis: {
        totalRevenue,
        totalOrders,
        totalProducts,
        lowStockCount,
      },
      recentOrders,
      lowStockList,
      statusBreakdown,
    };
  }

  /**
   * Retrieves audit logs for security oversight.
   */
  static async getAuditLogs(page: number = 1, limit: number = 25): Promise<any> {
    const offset = (page - 1) * limit;

    const countRes: any = await query('SELECT COUNT(*) AS total FROM admin_audit_logs');
    const total = countRes[0]?.total || 0;

    const logs: any = await query(
      `SELECT al.*, a.email AS admin_email, a.first_name, a.last_name
       FROM admin_audit_logs al
       LEFT JOIN admin_users a ON al.admin_id = a.id
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return {
      logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves inventory stock levels across all variants.
   */
  static async getInventory(queryParam: any): Promise<{ inventory: any[]; total: number }> {
    const page = Math.max(1, Number(queryParam.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(queryParam.limit) || 20));
    const offset = (page - 1) * limit;

    const where: string[] = ['pv.is_active = 1', 'p.deleted_at IS NULL'];
    const params: any[] = [];

    if (queryParam.lowStockOnly === 'true' || queryParam.lowStockOnly === true) {
      where.push('pv.stock_quantity <= pv.low_stock_threshold');
    }
    if (queryParam.search) {
      where.push('(pv.sku LIKE ? OR p.name LIKE ?)');
      const term = `%${queryParam.search.trim()}%`;
      params.push(term, term);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const countRes: any = await query(
      `SELECT COUNT(*) as count FROM product_variants pv JOIN products p ON pv.product_id = p.id ${whereSql}`,
      params
    );
    const total = countRes[0]?.count || 0;

    const inventory: any = await query(
      `SELECT pv.id as variant_id, pv.sku, pv.price, pv.compare_at_price,
              pv.stock_quantity, pv.low_stock_threshold,
              p.id as product_id, p.name as product_name, p.slug as product_slug,
              (SELECT s3_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image_url,
              c.name as category_name
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       JOIN product_categories c ON p.category_id = c.id
       ${whereSql}
       ORDER BY pv.stock_quantity ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { inventory, total };
  }

  /**
   * Adjusts inventory stock with transactional ledger logging.
   */
  static async adjustInventory(adminId: number, data: { variantId: number; quantityChange: number; type: string; notes?: string }): Promise<any> {
    return withTransaction(async (conn) => {
      const [variants]: any = await conn.query('SELECT * FROM product_variants WHERE id = ? FOR UPDATE', [data.variantId]);
      if (!variants.length) {
        throw new AppError('Variant not found', 404, 'NOT_FOUND');
      }
      const currentVariant = variants[0];
      const previousStock = currentVariant.stock_quantity;
      const newStock = Math.max(0, previousStock + data.quantityChange);

      await conn.query('UPDATE product_variants SET stock_quantity = ? WHERE id = ?', [newStock, data.variantId]);

      await conn.query(
        `INSERT INTO inventory_transactions (
          variant_id, transaction_type, quantity_change, previous_stock, current_stock,
          reference_type, notes, created_by_admin_id
        ) VALUES (?, ?, ?, ?, ?, 'MANUAL_ADJUSTMENT', ?, ?)`,
        [data.variantId, data.type || 'RESTOCK', data.quantityChange, previousStock, newStock, data.notes || 'Admin manual stock adjustment', adminId]
      );

      await conn.query(
        `INSERT INTO admin_audit_logs (admin_id, action, resource_type, resource_id, old_values, new_values, ip_address)
         VALUES (?, 'ADJUST_INVENTORY', 'INVENTORY', ?, ?, ?, '127.0.0.1')`,
        [adminId, data.variantId.toString(), JSON.stringify({ stock: previousStock }), JSON.stringify({ stock: newStock, change: data.quantityChange })]
      );

      return { variantId: data.variantId, previousStock, currentStock: newStock };
    });
  }

  /**
   * Gets recent inventory transaction ledger.
   */
  static async getInventoryTransactions(limit: number = 20): Promise<any[]> {
    return query(
      `SELECT it.*, pv.sku, p.name as product_name, a.first_name, a.last_name
       FROM inventory_transactions it
       JOIN product_variants pv ON it.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       LEFT JOIN admin_users a ON it.created_by_admin_id = a.id
       ORDER BY it.created_at DESC
       LIMIT ?`,
      [limit]
    );
  }
}

