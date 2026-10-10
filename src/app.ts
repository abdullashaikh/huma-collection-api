import 'express-async-errors';
import compression from 'compression';
import cookieParser from 'cookie-parser';

import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { testDbConnection } from './config/database';
import { corsOriginsArray, env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middleware/error-handler';
import { globalLimiter } from './middleware/rate-limiter';
import { requestIdMiddleware } from './middleware/request-id';

// Module Routers
import adminRouter from './modules/admin/admin.routes';
import authRouter from './modules/auth/auth.routes';
import cartRouter from './modules/cart/cart.routes';
import categoriesRouter from './modules/categories/categories.routes';
import couponsRouter from './modules/coupons/coupons.routes';
import mediaRouter from './modules/media/media.routes';
import ordersRouter from './modules/orders/orders.routes';
import paymentsRouter from './modules/payments/payments.routes';
import productsRouter from './modules/products/products.routes';
import settingsRouter from './modules/settings/settings.routes';
import shippingRouter from './modules/shipping/shipping.routes';

export function createApp(): Application {
  const app = express();

  // 1. Trust proxy for CloudFront / ALB / Docker setups
  app.set('trust proxy', 1);

  // 2. Request Correlation ID
  app.use(requestIdMiddleware);

  // 3. Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://checkout.razorpay.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://images.unsplash.com',
            'https://*.cloudfront.net',
            `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com`,
          ],
          connectSrc: [
            "'self'",
            'https://api.razorpay.com',
            'https://lumberjack.razorpay.com',
            `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com`,
          ],
          frameSrc: ["'self'", 'https://api.razorpay.com'],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    })
  );

  // 4. CORS Whitelist
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (corsOriginsArray.indexOf(origin) !== -1 || env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        callback(new Error(`CORS origin '${origin}' is not permitted.`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Session-ID'],
    })
  );

  // 5. Compression & Cookie Parser
  app.use(compression());
  app.use(cookieParser(env.COOKIE_SECRET));

  // 6. JSON Body Parser with Raw Body preservation for Webhooks
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res, buf) => {
        if (req.originalUrl.includes('/webhook')) {
          req.rawBody = buf;
        }
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 7. HTTP Request Logger (Morgan piped to Winston in production)
  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    })
  );

  // 8. Global Rate Limiter
  app.use(globalLimiter);

  // 9. Health & Readiness Observability Probes
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      service: env.APP_NAME,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get('/ready', async (_req: Request, res: Response) => {
    const dbStatus = await testDbConnection();
    const memoryUsage = process.memoryUsage();

    const isReady = dbStatus.healthy;
    const statusCode = isReady ? 200 : 503;

    res.status(statusCode).json({
      status: isReady ? 'READY' : 'NOT_READY',
      checks: {
        database: {
          healthy: dbStatus.healthy,
          latencyMs: dbStatus.latencyMs,
        },
        memory: {
          heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        },
      },
      timestamp: new Date().toISOString(),
    });
  });

  // 10. Mount Versioned REST API Routes (/api/v1)
  const apiV1 = express.Router();
  apiV1.use('/auth', authRouter);
  apiV1.use('/products', productsRouter);
  apiV1.use('/categories', categoriesRouter);
  apiV1.use('/cart', cartRouter);
  apiV1.use('/shipping', shippingRouter);
  apiV1.use('/coupons', couponsRouter);
  apiV1.use('/orders', ordersRouter);
  apiV1.use('/payments', paymentsRouter);
  apiV1.use('/media', mediaRouter);
  apiV1.use('/settings', settingsRouter);
  apiV1.use('/admin', adminRouter);

  app.use(env.API_PREFIX, apiV1);

  // 11. 404 Route Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      statusCode: 404,
      message: `The requested endpoint '${req.method} ${req.originalUrl}' does not exist on this server.`,
      error: { code: 'ROUTE_NOT_FOUND', message: 'Resource not found' },
    });
  });

  // 12. Centralized Error Handler Middleware
  app.use(errorHandler);

  return app;
}
