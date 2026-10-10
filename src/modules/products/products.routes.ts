import { Router } from 'express';
import { authenticateAdmin, requirePermission } from '../../middleware/auth';
import { ProductsController } from './products.controller';

const router = Router();

// 1. Admin Management endpoints (placed first to prevent clash with /:slug)
router.get(
  '/admin/all',
  authenticateAdmin,
  requirePermission('products:read'),
  ProductsController.adminGetProducts
);

router.post(
  '/',
  authenticateAdmin,
  requirePermission('products:write'),
  ProductsController.adminCreateProduct
);

router.put(
  '/admin/:id',
  authenticateAdmin,
  requirePermission('products:write'),
  ProductsController.adminUpdateProduct
);

router.patch(
  '/admin/:id',
  authenticateAdmin,
  requirePermission('products:write'),
  ProductsController.adminUpdateProduct
);

router.patch(
  '/admin/:id/status',
  authenticateAdmin,
  requirePermission('products:write'),
  ProductsController.adminUpdateStatus
);

router.delete(
  '/admin/:id',
  authenticateAdmin,
  requirePermission('products:delete'),
  ProductsController.adminDeleteProduct
);

// 2. Public Catalog endpoints
router.get('/', ProductsController.getProducts);
router.get('/:slug', ProductsController.getProductBySlug);

export default router;
