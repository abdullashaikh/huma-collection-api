import { Router } from 'express';
import { authenticateCustomer } from '../../middleware/auth';
import { CartController } from './cart.controller';

const router = Router();

// Cart endpoints work for both logged-in and guest customers
router.get('/', authenticateCustomer({ optional: true }), CartController.getCart);
router.post('/items', authenticateCustomer({ optional: true }), CartController.addItem);
router.put('/items/:id', authenticateCustomer({ optional: true }), CartController.updateItem);
router.delete('/items/:id', authenticateCustomer({ optional: true }), CartController.removeItem);
router.delete('/', authenticateCustomer({ optional: true }), CartController.clearCart);

export default router;
