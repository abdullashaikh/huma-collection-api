import { query } from '../../config/database';
import { AppError } from '../../middleware/error-handler';

export class CouponsService {
  /**
   * Validates a coupon code and returns calculated discount.
   */
  static async validateAndCalculateDiscount(
    code: string,
    cartSubtotal: number,
    userId?: number
  ): Promise<{
    couponId: number;
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    discountAmount: number;
    finalTotal: number;
  }> {
    const cleanCode = code.trim().toUpperCase();

    const coupons: any = await query(
      `SELECT * FROM coupons
       WHERE code = ? AND is_active = 1
         AND valid_from <= NOW() AND valid_until >= NOW()
       LIMIT 1`,
      [cleanCode]
    );

    if (!coupons.length) {
      throw new AppError('Invalid or expired coupon code.', 400, 'COUPON_INVALID');
    }

    const coupon = coupons[0];
    const minOrder = parseFloat(coupon.min_order_value);

    if (cartSubtotal < minOrder) {
      throw new AppError(
        `This coupon requires a minimum cart value of ₹${minOrder.toLocaleString('en-IN')}`,
        400,
        'COUPON_MIN_ORDER_NOT_MET'
      );
    }

    // Check global usage limit
    if (coupon.usage_limit_total !== null && coupon.times_used >= coupon.usage_limit_total) {
      throw new AppError('This promotional coupon has reached its maximum redemptions.', 400, 'COUPON_EXHAUSTED');
    }

    // Check per-user limit
    if (userId && coupon.usage_limit_per_user) {
      const usageCount: any = await query(
        'SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = ? AND user_id = ?',
        [coupon.id, userId]
      );
      if (usageCount[0].count >= coupon.usage_limit_per_user) {
        throw new AppError('You have already redeemed this promotional coupon.', 400, 'COUPON_ALREADY_USED');
      }
    }

    // Calculate discount
    let discountAmount = 0;
    const discountVal = parseFloat(coupon.discount_value);

    if (coupon.discount_type === 'PERCENTAGE') {
      discountAmount = (cartSubtotal * discountVal) / 100;
      if (coupon.max_discount_amount) {
        discountAmount = Math.min(discountAmount, parseFloat(coupon.max_discount_amount));
      }
    } else {
      discountAmount = Math.min(cartSubtotal, discountVal);
    }

    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalTotal = Math.max(0, cartSubtotal - discountAmount);

    return {
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: discountVal,
      discountAmount,
      finalTotal,
    };
  }

  /**
   * Admin: List all coupons.
   */
  static async adminGetCoupons(): Promise<any[]> {
    return query('SELECT * FROM coupons ORDER BY created_at DESC');
  }

  /**
   * Admin: Create new promotion coupon.
   */
  static async adminCreateCoupon(data: any): Promise<any> {
    const res: any = await query(
      `INSERT INTO coupons (
        code, discount_type, discount_value, min_order_value, max_discount_amount,
        usage_limit_total, usage_limit_per_user, valid_from, valid_until, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()), ?, 1)`,
      [
        data.code.trim().toUpperCase(),
        data.discountType,
        data.discountValue,
        data.minOrderValue || 0,
        data.maxDiscountAmount || null,
        data.usageLimitTotal || null,
        data.usageLimitPerUser || 1,
        data.validFrom || null,
        data.validUntil,
      ]
    );
    return { id: res.insertId, code: data.code.toUpperCase() };
  }

  /**
   * Admin: Toggle coupon active status.
   */
  static async adminToggleCoupon(id: number): Promise<void> {
    await query('UPDATE coupons SET is_active = NOT is_active WHERE id = ?', [id]);
  }
}

