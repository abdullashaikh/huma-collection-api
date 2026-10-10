import { Router } from 'express';
import { authenticateAdmin, requirePermission } from '../../middleware/auth';
import { ProductsController } from './products.controller';

const router = Router();

// Public Catalog endpoints
router.get('/', ProductsController.getProducts);
router.get('/:slug', ProductsController.getProductBySlug);

// Admin Management endpoints
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

export default router;

