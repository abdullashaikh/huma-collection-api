import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess } from '../../utils/response';
import { CouponsService } from './coupons.service';

const applyCouponSchema = z.object({
  code: z.string().min(2, 'Coupon code is required'),
  subtotal: z.number().positive('Cart subtotal must be greater than 0'),
});

export class CouponsController {
  static async applyCoupon(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { code, subtotal } = applyCouponSchema.parse(req.body);
    const userId = req.customer?.userId;
    const result = await CouponsService.validateAndCalculateDiscount(code, subtotal, userId);
    sendSuccess(res, result, `Coupon ${result.code} applied successfully! You saved ₹${result.discountAmount}`);
  }

  static async adminGetCoupons(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const coupons = await CouponsService.adminGetCoupons();
    sendSuccess(res, coupons, 'Coupons retrieved');
  }

  static async adminCreateCoupon(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await CouponsService.adminCreateCoupon(req.body);
    sendSuccess(res, result, 'Coupon created successfully', 201);
  }

  static async adminToggleCoupon(req: AuthenticatedRequest, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    await CouponsService.adminToggleCoupon(id);
    sendSuccess(res, null, 'Coupon status toggled');
  }
}

