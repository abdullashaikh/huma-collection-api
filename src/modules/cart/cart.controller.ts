import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess } from '../../utils/response';
import { CartService } from './cart.service';

const addItemSchema = z.object({
  sessionId: z.string().min(5),
  variantId: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
});

const updateItemSchema = z.object({
  sessionId: z.string().min(5),
  quantity: z.number().int().nonnegative(),
});

export class CartController {
  static async getCart(req: AuthenticatedRequest, res: Response): Promise<void> {
    const sessionId = (req.query.sessionId as string) || (req.headers['x-session-id'] as string) || 'guest_default';
    const userId = req.customer?.userId;

    const cartId = await CartService.getOrCreateCart(sessionId, userId);
    const summary = await CartService.getCartSummary(cartId);

    sendSuccess(res, summary, 'Cart retrieved');
  }

  static async addItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { sessionId, variantId, quantity } = addItemSchema.parse(req.body);
    const userId = req.customer?.userId;

    const cartId = await CartService.getOrCreateCart(sessionId, userId);
    await CartService.addItem(cartId, variantId, quantity);
    const summary = await CartService.getCartSummary(cartId);

    sendSuccess(res, summary, 'Item added to bag', 200);
  }

  static async updateItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    const cartItemId = parseInt(req.params.id, 10);
    const { sessionId, quantity } = updateItemSchema.parse(req.body);
    const userId = req.customer?.userId;

    const cartId = await CartService.getOrCreateCart(sessionId, userId);
    await CartService.updateItemQuantity(cartId, cartItemId, quantity);
    const summary = await CartService.getCartSummary(cartId);

    sendSuccess(res, summary, 'Cart updated');
  }

  static async removeItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    const cartItemId = parseInt(req.params.id, 10);
    const sessionId = (req.query.sessionId as string) || (req.headers['x-session-id'] as string) || 'guest_default';
    const userId = req.customer?.userId;

    const cartId = await CartService.getOrCreateCart(sessionId, userId);
    await CartService.removeItem(cartId, cartItemId);
    const summary = await CartService.getCartSummary(cartId);

    sendSuccess(res, summary, 'Item removed from bag');
  }

  static async clearCart(req: AuthenticatedRequest, res: Response): Promise<void> {
    const sessionId = (req.query.sessionId as string) || (req.headers['x-session-id'] as string) || 'guest_default';
    const userId = req.customer?.userId;

    const cartId = await CartService.getOrCreateCart(sessionId, userId);
    await CartService.clearCart(cartId);
    const summary = await CartService.getCartSummary(cartId);

    sendSuccess(res, summary, 'Cart cleared');
  }
}
