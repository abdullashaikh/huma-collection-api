import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import { logger } from '../config/logger';

async function runMigration() {
  logger.info('🚀 Starting database migration...');
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  // Split on semicolons that terminate statements
  // Filter out empty lines or pure comments
  const statements = sql
    .split(/;\s*[\r\n]+/)
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

  const connection = await pool.getConnection();

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    let count = 0;
    for (const statement of statements) {
      if (!statement) continue;
      await connection.query(statement);
      count++;
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    logger.info(`✅ Successfully executed ${count} schema statements.`);

    // Verify created tables
    const [tables]: any = await connection.query('SHOW TABLES');
    const tableNames = tables.map((row: any) => Object.values(row)[0]);
    logger.info(`📋 Database tables verified (${tableNames.length}): ${tableNames.join(', ')}`);
  } catch (error: any) {
    logger.error('❌ Migration failed:', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

runMigration();
