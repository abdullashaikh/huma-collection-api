import { pool } from '../config/database';
import { logger } from '../config/logger';

export async function runCatalogueMigration() {
  logger.info('🚀 Running Catalogue & Audience Schema Migration...');
  const conn = await pool.getConnection();

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Check and add audience to product_categories
    const [catCols]: any = await conn.query("SHOW COLUMNS FROM product_categories LIKE 'audience'");
    if (catCols.length === 0) {
      logger.info('Adding audience column to product_categories...');
      await conn.query(`
        ALTER TABLE product_categories
        ADD COLUMN audience ENUM('MEN', 'WOMEN', 'ALL') NOT NULL DEFAULT 'WOMEN' AFTER image_url,
        ADD INDEX idx_cat_audience (audience);
      `);
    }

    // 2. Check and add columns to products
    const [subcatCols]: any = await conn.query("SHOW COLUMNS FROM products LIKE 'subcategory_id'");
    if (subcatCols.length === 0) {
      logger.info('Adding subcategory_id column to products...');
      await conn.query(`
        ALTER TABLE products
        ADD COLUMN subcategory_id INT NULL AFTER category_id,
        ADD INDEX idx_prod_subcat (subcategory_id),
        ADD CONSTRAINT fk_prod_subcat FOREIGN KEY (subcategory_id) REFERENCES product_categories(id) ON DELETE SET NULL;
      `);
    }

    const [prodAudienceCols]: any = await conn.query("SHOW COLUMNS FROM products LIKE 'audience'");
    if (prodAudienceCols.length === 0) {
      logger.info('Adding audience column to products...');
      await conn.query(`
        ALTER TABLE products
        ADD COLUMN audience ENUM('MEN', 'WOMEN', 'ALL') NOT NULL DEFAULT 'WOMEN' AFTER subcategory_id,
        ADD INDEX idx_prod_audience (audience);
      `);
    }

    const [prodDisplayOrderCols]: any = await conn.query("SHOW COLUMNS FROM products LIKE 'display_order'");
    if (prodDisplayOrderCols.length === 0) {
      logger.info('Adding display_order column to products...');
      await conn.query(`
        ALTER TABLE products
        ADD COLUMN display_order INT NOT NULL DEFAULT 0 AFTER sale_price,
        ADD INDEX idx_prod_display_order (display_order);
      `);
    }

    const [materialsCols]: any = await conn.query("SHOW COLUMNS FROM products LIKE 'materials'");
    if (materialsCols.length === 0) {
      logger.info('Adding materials, colors, tags columns to products...');
      await conn.query(`
        ALTER TABLE products
        ADD COLUMN materials VARCHAR(255) NULL AFTER fabric,
        ADD COLUMN colors JSON NULL AFTER style,
        ADD COLUMN tags JSON NULL AFTER care_instructions;
      `);
    }

    // 3. Check and add view_type to product_images
    const [imgCols]: any = await conn.query("SHOW COLUMNS FROM product_images LIKE 'view_type'");
    if (imgCols.length === 0) {
      logger.info('Adding view_type column to product_images...');
      await conn.query(`
        ALTER TABLE product_images
        ADD COLUMN view_type VARCHAR(50) NOT NULL DEFAULT 'FRONT' AFTER is_primary;
      `);
    }

    // 4. Create product_category_mappings table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS product_category_mappings (
        product_id BIGINT NOT NULL,
        category_id INT NOT NULL,
        is_primary BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (product_id, category_id),
        CONSTRAINT fk_pcm_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT fk_pcm_category FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Add category management permissions
    const permissions = [
      ['categories:read', 'View Product Categories', 'categories'],
      ['categories:write', 'Create and Edit Product Categories', 'categories'],
      ['categories:delete', 'Delete Product Categories', 'categories'],
    ];

    for (const [code, name, module] of permissions) {
      await conn.query(
        `INSERT INTO permissions (code, name, module) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), module = VALUES(module)`,
        [code, name, module]
      );
    }

    await conn.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT 1, id FROM permissions WHERE module = 'categories';
    `);

    // 6. Update audience for initial categories if currently defaulted
    logger.info('Updating initial audience scopes for sample categories...');
    await conn.query("UPDATE product_categories SET audience = 'MEN' WHERE slug IN ('topi')");
    await conn.query("UPDATE product_categories SET audience = 'ALL' WHERE slug IN ('perfume-attar', 'hajj-umrah', 'tasbih', 'miswak')");
    await conn.query("UPDATE product_categories SET audience = 'WOMEN' WHERE slug IN ('burqa', 'hijab', 'abaya', 'niqab', 'nospice', 'janamaz', 'rumal')");

    // 7. Sync audience on products from their category
    await conn.query(`
      UPDATE products p
      JOIN product_categories c ON p.category_id = c.id
      SET p.audience = c.audience
      WHERE p.audience IS NULL OR p.audience = 'WOMEN';
    `);

    // 8. Populate product_category_mappings from existing products
    await conn.query(`
      INSERT IGNORE INTO product_category_mappings (product_id, category_id, is_primary)
      SELECT id, category_id, 1 FROM products;
    `);

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    logger.info('✅ Catalogue & Audience Schema Migration successfully completed!');
  } catch (err: any) {
    logger.error('❌ Migration error:', { message: err.message, stack: err.stack });
    throw err;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  runCatalogueMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
