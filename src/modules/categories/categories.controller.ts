import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { CategoriesService } from './categories.service';

export class CategoriesController {
  static async getCategories(_req: Request, res: Response): Promise<void> {
    const categories = await CategoriesService.getCategories();
    sendSuccess(res, categories, 'Categories retrieved successfully');
  }

  static async getCategoryBySlug(req: Request, res: Response): Promise<void> {
    const category = await CategoriesService.getCategoryBySlug(req.params.slug);
    if (!category) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }
    sendSuccess(res, category, 'Category details retrieved');
  }
}
