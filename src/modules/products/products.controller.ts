import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess } from '../../utils/response';
import { ProductsService } from './products.service';

const getProductsQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  fabric: z.string().optional(),
  style: z.string().optional(),
  size: z.string().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest', 'bestseller']).optional(),
  featuredOnly: z.coerce.boolean().optional(),
});

const createProductSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().min(3),
  slug: z.string().min(3),
  skuBase: z.string().min(3),
  shortDescription: z.string().min(10),
  description: z.string().min(20),
  fabric: z.string().optional(),
  pattern: z.string().optional(),
  style: z.string().optional(),
  careInstructions: z.string().optional(),
  basePrice: z.number().positive(),
  salePrice: z.number().positive().optional(),
  isFeatured: z.boolean().optional(),
  isBestseller: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  images: z.array(z.object({
    s3Key: z.string().optional(),
    s3Url: z.string().url(),
    altText: z.string().optional(),
    isPrimary: z.boolean().optional(),
  })).optional(),
  variants: z.array(z.object({
    sku: z.string(),
    price: z.number().positive(),
    compareAtPrice: z.number().positive().optional(),
    stockQuantity: z.number().int().nonnegative(),
    lowStockThreshold: z.number().int().optional(),
  })).min(1, 'At least one variant is required'),
});

export class ProductsController {
  static async getProducts(req: Request, res: Response): Promise<void> {
    const filters = getProductsQuerySchema.parse(req.query);
    const { products, meta } = await ProductsService.getProducts(filters);
    sendSuccess(res, products, 'Products retrieved successfully', 200, meta);
  }

  static async getProductBySlug(req: Request, res: Response): Promise<void> {
    const slug = req.params.slug;
    const product = await ProductsService.getProductBySlug(slug);
    const related = await ProductsService.getRelatedProducts(product.id, product.categoryId, 4);
    sendSuccess(res, { ...product, relatedProducts: related }, 'Product details retrieved');
  }

  static async adminGetProducts(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { products, total } = await ProductsService.adminGetProducts(req.query);
    sendSuccess(res, products, 'Products retrieved successfully', 200, {
      total,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
  }

  static async adminCreateProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = createProductSchema.parse(req.body);
    const adminId = req.admin?.adminId || 1;
    const result = await ProductsService.adminCreateProduct(data, adminId);
    sendSuccess(res, result, 'Product created successfully', 201);
  }

  static async adminUpdateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const productId = parseInt(req.params.id, 10);
    const { status } = req.body;
    const adminId = req.admin?.adminId || 1;
    await ProductsService.adminUpdateStatus(productId, status, adminId);
    sendSuccess(res, null, `Product status changed to ${status}`);
  }

  static async adminDeleteProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
    const productId = parseInt(req.params.id, 10);
    const adminId = req.admin?.adminId || 1;
    await ProductsService.adminDeleteProduct(productId, adminId);
    sendSuccess(res, null, 'Product deleted successfully');
  }
}

