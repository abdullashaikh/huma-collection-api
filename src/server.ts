import { createApp } from './app';
import { pool, testDbConnection } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';

async function startServer() {
  try {
    logger.info(`✨ Starting ${env.APP_NAME} in [${env.NODE_ENV}] mode...`);

    // Verify Database Connection before opening port
    const dbCheck = await testDbConnection();
    if (!dbCheck.healthy) {
      logger.error('❌ Failed to connect to MySQL database during startup. Exiting.');
      process.exit(1);
    }
    logger.info(`✅ Connected to MySQL 8.0 on ${env.DB_HOST}:${env.DB_PORT} (Latency: ${dbCheck.latencyMs}ms)`);

    const app = createApp();

    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Server running on port ${env.PORT}`);
      logger.info(`📡 API Base URL: http://localhost:${env.PORT}${env.API_PREFIX}`);
      logger.info(`🩺 Health check: http://localhost:${env.PORT}/health`);
      logger.info(`🩺 Readiness check: http://localhost:${env.PORT}/ready`);
    });

    // Graceful Shutdown on SIGINT / SIGTERM
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        logger.info('HTTP server closed.');
        try {
          await pool.end();
          logger.info('Database pool closed.');
          process.exit(0);
        } catch (err: any) {
          logger.error('Error closing database pool:', { error: err.message });
          process.exit(1);
        }
      });

      // Force close if graceful shutdown takes longer than 10 seconds
      setTimeout(() => {
        logger.error('Forceful shutdown timeout exceeded.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error: any) {
    logger.error('Fatal startup error:', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

startServer();
