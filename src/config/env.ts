import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// Load .env or .env.production
const envProdPath = path.resolve(__dirname, '../../.env.production');
const envDevPath = path.resolve(__dirname, '../../.env');

if (process.env.NODE_ENV === 'production' && fs.existsSync(envProdPath)) {
  dotenv.config({ path: envProdPath });
} else {
  dotenv.config({ path: envDevPath });
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  APP_NAME: z.string().default('Huma Hijab Collection API'),
  API_PREFIX: z.string().default('/api/v1'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  ADMIN_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),

  // Database
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default('root'),
  DB_NAME: z.string().default('huma_collection_db'),
  DB_CONNECTION_LIMIT: z.coerce.number().default(20),
  DB_WAIT_FOR_CONNECTIONS: z.coerce.boolean().default(true),

  // JWT & Security
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  COOKIE_SECRET: z.string().default('huma_default_cookie_secret_secure_987'),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().default('rzp_test_HumaHijab2026'),
  RAZORPAY_KEY_SECRET: z.string().default('HumaTestSecretKey987654321'),
  RAZORPAY_WEBHOOK_SECRET: z.string().default('HumaWebhookSecretSecure999'),

  // AWS S3
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string().default('AKIA_DEFAULT_KEY'),
  AWS_SECRET_ACCESS_KEY: z.string().default('default_secret_key'),
  AWS_S3_BUCKET: z.string().default('huma-collection-media-prod'),
  CLOUDFRONT_DOMAIN: z.string().default('https://images.unsplash.com'),

  // Business Defaults
  WHATSAPP_SUPPORT_NUMBER: z.string().default('+919876543210'),
  SUPPORT_EMAIL: z.string().default('support@humahijabcollection.com'),
  STORE_NAME: z.string().default('Huma Hijab Collection'),
  DEFAULT_CURRENCY: z.string().default('INR'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment validation failed:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
export const corsOriginsArray = env.CORS_ORIGINS.split(',').map((origin) => origin.trim());
