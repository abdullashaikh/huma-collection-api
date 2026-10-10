import { query } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { CartItemCalculated, CartSummary } from '../../types';

export class CartService {
  /**
   * Finds or creates a shopping cart for a user or guest session.
   */
  static async getOrCreateCart(sessionId: string, userId?: number): Promise<number> {
    if (userId) {
      const userCarts: any = await query('SELECT id FROM carts WHERE user_id = ? LIMIT 1', [userId]);
      if (userCarts.length > 0) return userCarts[0].id;
    }

    const sessionCarts: any = await query('SELECT id FROM carts WHERE session_id = ? LIMIT 1', [sessionId]);
    if (sessionCarts.length > 0) {
      if (userId) {
        await query('UPDATE carts SET user_id = ? WHERE id = ?', [userId, sessionCarts[0].id]);
      }
      return sessionCarts[0].id;
    }

    const res: any = await query(
      'INSERT INTO carts (user_id, session_id) VALUES (?, ?)',
      [userId || null, sessionId]
    );
    return res.insertId;
  }

  /**
   * Retrieves cart summary with 100% server-verified prices and stock.
   */
  static async getCartSummary(cartId: number): Promise<CartSummary> {
    const rawItems: any = await query(
      `SELECT
        ci.id AS cart_item_id, ci.cart_id, ci.variant_id, ci.quantity,
        pv.sku AS variant_sku, pv.price AS current_price, pv.compare_at_price,
        pv.stock_quantity, pv.is_active AS variant_active,
        p.id AS product_id, p.name AS product_name, p.slug AS product_slug,
        p.status AS product_status,
        (
          SELECT s3_url FROM product_images
          WHERE product_id = p.id AND is_primary = 1
          LIMIT 1
        ) AS image_url
       FROM cart_items ci
       JOIN product_variants pv ON ci.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       WHERE ci.cart_id = ? AND p.deleted_at IS NULL`,
      [cartId]
    );

    let totalQuantity = 0;
    let subtotal = 0;
    const items: CartItemCalculated[] = [];

    for (const item of rawItems) {
      const isAvailable =
        item.variant_active === 1 &&
        item.product_status === 'ACTIVE' &&
        item.stock_quantity >= item.quantity;

      const unitPrice = parseFloat(item.current_price);
      const itemSubtotal = isAvailable ? unitPrice * item.quantity : 0;

      if (isAvailable) {
        totalQuantity += item.quantity;
        subtotal += itemSubtotal;
      }

      // Fetch variant attributes
      const attrs: any = await query(
        `SELECT pa.name, pav.value
         FROM product_variant_attributes pva
         JOIN product_attribute_values pav ON pva.attribute_value_id = pav.id
         JOIN product_attributes pa ON pav.attribute_id = pa.id
         WHERE pva.variant_id = ?`,
        [item.variant_id]
      );
      const attrMap: Record<string, string> = {};
      for (const a of attrs) {
        attrMap[a.name] = a.value;
      }

      items.push({
        id: item.cart_item_id,
        cartId: item.cart_id,
        variantId: item.variant_id,
        productId: item.product_id,
        productName: item.product_name,
        productSlug: item.product_slug,
        variantSku: item.variant_sku,
        quantity: item.quantity,
        unitPrice,
        compareAtPrice: item.compare_at_price ? parseFloat(item.compare_at_price) : null,
        subtotal: itemSubtotal,
        imageUrl: item.image_url || '',
        stockAvailable: item.stock_quantity,
        isAvailable,
        attributes: attrMap,
      });
    }

    // Default shipping threshold: Free above ₹1499, else ₹99
    const freeShippingThreshold = 1499.0;
    const shippingCharge = subtotal >= freeShippingThreshold || subtotal === 0 ? 0 : 99.0;
    const discount = 0;
    const codCharge = 0;
    const tax = 0; // Tax included in MRP as per standard Indian retail apparel
    const grandTotal = Math.max(0, subtotal - discount + shippingCharge + codCharge);

    return {
      items,
      totalQuantity,
      subtotal,
      discount,
      shippingCharge,
      codCharge,
      tax,
      grandTotal,
      appliedCoupon: null,
    };
  }

  /**
   * Adds an item to the cart after validating stock.
   */
  static async addItem(cartId: number, variantId: number, quantity: number = 1): Promise<void> {
    if (quantity <= 0) {
      throw new AppError('Quantity must be at least 1', 400, 'INVALID_QUANTITY');
    }

    const variants: any = await query(
      `SELECT pv.id, pv.stock_quantity, pv.is_active, p.status, p.deleted_at
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       WHERE pv.id = ?`,
      [variantId]
    );

    if (!variants.length || !variants[0].is_active || variants[0].status !== 'ACTIVE' || variants[0].deleted_at !== null) {
      throw new AppError('Selected product variant is unavailable', 400, 'VARIANT_UNAVAILABLE');
    }

    const availableStock = variants[0].stock_quantity;

    // Check existing quantity in cart
    const existing: any = await query(
      'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?',
      [cartId, variantId]
    );

    const existingQty = existing.length > 0 ? existing[0].quantity : 0;
    const newQty = existingQty + quantity;

    if (newQty > availableStock) {
      throw new AppError(
        `Only ${availableStock} unit(s) available in stock. Cannot add requested quantity.`,
        400,
        'INSUFFICIENT_STOCK'
      );
    }

    if (existing.length > 0) {
      await query('UPDATE cart_items SET quantity = ? WHERE id = ?', [newQty, existing[0].id]);
    } else {
      await query(
        'INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES (?, ?, ?)',
        [cartId, variantId, quantity]
      );
    }
  }

  /**
   * Updates item quantity in cart.
   */
  static async updateItemQuantity(cartId: number, cartItemId: number, quantity: number): Promise<void> {
    if (quantity <= 0) {
      await this.removeItem(cartId, cartItemId);
      return;
    }

    const items: any = await query(
      `SELECT ci.id, ci.variant_id, pv.stock_quantity
       FROM cart_items ci
       JOIN product_variants pv ON ci.variant_id = pv.id
       WHERE ci.id = ? AND ci.cart_id = ?`,
      [cartItemId, cartId]
    );

    if (!items.length) {
      throw new AppError('Cart item not found', 404, 'NOT_FOUND');
    }

    if (quantity > items[0].stock_quantity) {
      throw new AppError(
        `Only ${items[0].stock_quantity} unit(s) available in stock.`,
        400,
        'INSUFFICIENT_STOCK'
      );
    }

    await query('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, cartItemId]);
  }

  /**
   * Removes an item from the cart.
   */
  static async removeItem(cartId: number, cartItemId: number): Promise<void> {
    await query('DELETE FROM cart_items WHERE id = ? AND cart_id = ?', [cartItemId, cartId]);
  }

  /**
   * Empties the cart.
   */
  static async clearCart(cartId: number): Promise<void> {
    await query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
  }
}
