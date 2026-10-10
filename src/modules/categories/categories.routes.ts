import { Router } from 'express';
import { authenticateAdmin, requirePermission } from '../../middleware/auth';
import { CategoriesController } from './categories.controller';

const router = Router();

// 1. Admin Management Endpoints (registered first to prevent route collisions with /:slug)
router.get(
  '/admin/all',
  authenticateAdmin,
  requirePermission('products:read'),
  CategoriesController.adminGetCategories
);

router.post(
  '/',
  authenticateAdmin,
  requirePermission('products:write'),
  CategoriesController.adminCreateCategory
);

router.put(
  '/admin/:id',
  authenticateAdmin,
  requirePermission('products:write'),
  CategoriesController.adminUpdateCategory
);

router.patch(
  '/admin/:id',
  authenticateAdmin,
  requirePermission('products:write'),
  CategoriesController.adminUpdateCategory
);

router.patch(
  '/admin/:id/status',
  authenticateAdmin,
  requirePermission('products:write'),
  CategoriesController.adminUpdateStatus
);

router.delete(
  '/admin/:id',
  authenticateAdmin,
  requirePermission('products:delete'),
  CategoriesController.adminDeleteCategory
);

// 2. Public Catalog Endpoints
router.get('/', CategoriesController.getCategories);
router.get('/:id/products', CategoriesController.getCategoryProducts);
router.get('/:slug', CategoriesController.getCategoryBySlug);

export default router;
