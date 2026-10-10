import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess } from '../../utils/response';
import { CategoriesService } from './categories.service';

const categoryQuerySchema = z.object({
  audience: z.enum(['MEN', 'WOMEN', 'ALL', 'men', 'women', 'all', 'both', 'BOTH']).optional(),
  parentId: z.union([z.coerce.number(), z.literal('root')]).optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z.string().min(2, 'Slug must be at least 2 characters').max(120),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url('Image URL must be valid').optional().nullable().or(z.literal('')),
  audience: z.enum(['MEN', 'WOMEN', 'ALL']).default('WOMEN'),
  parentId: z.number().int().positive().optional().nullable(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(500).optional().nullable(),
});

const updateCategorySchema = createCategorySchema.partial();

export class CategoriesController {
  /**
   * Public: Retrieve published categories (supports audience & parentId filter)
   */
  static async getCategories(req: Request, res: Response): Promise<void> {
    const filters = categoryQuerySchema.parse(req.query);
    const categories = await CategoriesService.getCategories({
      audience: filters.audience?.toUpperCase(),
      parentId: filters.parentId,
      includeInactive: false,
    });
    sendSuccess(res, categories, 'Categories retrieved successfully');
  }

  /**
   * Public: Retrieve category by slug
   */
  static async getCategoryBySlug(req: Request, res: Response): Promise<void> {
    const category = await CategoriesService.getCategoryBySlug(req.params.slug);
    if (!category) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }
    sendSuccess(res, category, 'Category details retrieved');
  }

  /**
   * Admin: Retrieve all categories (including unpublished & subcategories)
   */
  static async adminGetCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
    const audience = req.query.audience ? String(req.query.audience).toUpperCase() : undefined;
    const categories = await CategoriesService.getCategories({
      audience,
      includeInactive: true,
    });
    sendSuccess(res, categories, 'Admin categories retrieved successfully');
  }

  /**
   * Admin: Create a new category
   */
  static async adminCreateCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = createCategorySchema.parse(req.body);
    const category = await CategoriesService.adminCreateCategory({
      ...data,
      imageUrl: data.imageUrl || null,
      description: data.description || null,
    });
    sendSuccess(res, category, 'Category created successfully', 201);
  }

  /**
   * Admin: Update an existing category
   */
  static async adminUpdateCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    const data = updateCategorySchema.parse(req.body);
    const category = await CategoriesService.adminUpdateCategory(id, {
      ...data,
      imageUrl: data.imageUrl || null,
      description: data.description || null,
    });
    sendSuccess(res, category, 'Category updated successfully');
  }

  /**
   * Admin: Toggle category active/published status
   */
  static async adminUpdateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    const { isActive } = req.body;
    await CategoriesService.adminUpdateStatus(id, Boolean(isActive));
    sendSuccess(res, null, `Category status updated successfully`);
  }

  /**
   * Admin: Delete category
   */
  static async adminDeleteCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    await CategoriesService.adminDeleteCategory(id);
    sendSuccess(res, null, 'Category deleted successfully');
  }

  /**
   * Admin / Public: View products inside a specific category
   */
  static async getCategoryProducts(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    const products = await CategoriesService.getCategoryProducts(id);
    sendSuccess(res, products, 'Category products retrieved');
  }
}
