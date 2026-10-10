import { Request, Response } from 'express';
import { z } from 'zod';
import { checkoutLimiter } from '../../middleware/rate-limiter';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess } from '../../utils/response';
import { OrdersService } from './orders.service';

const createOrderSchema = z.object({
  sessionId: z.string().min(3),
  customerName: z.string().min(2, 'Customer name is required'),
  customerPhone: z.string().min(10, 'Valid 10-digit phone number is required'),
  customerEmail: z.string().email().optional(),
  shippingAddress: z.object({
    fullName: z.string().min(2),
    phone: z.string().min(10),
    addressLine1: z.string().min(5),
    addressLine2: z.string().optional(),
    city: z.string().min(2),
    state: z.string().min(2),
    pincode: z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid Indian 6-digit postal pincode'),
    landmark: z.string().optional(),
  }),
  paymentMethod: z.enum(['RAZORPAY', 'COD']),
  couponCode: z.string().optional(),
  customerNotes: z.string().optional(),
});

export class OrdersController {
  static async createOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = createOrderSchema.parse(req.body);
    const userId = req.customer?.userId;

    const result = await OrdersService.createOrder({
      ...data,
      userId,
    });

    sendSuccess(res, result, 'Order initiated successfully', 201);
  }

  static async trackOrder(req: Request, res: Response): Promise<void> {
    const orderNumber = req.params.orderNumber;
    const phone = req.query.phone as string;
    if (!phone) {
      res.status(400).json({ success: false, message: 'Please provide phone number associated with the order.' });
      return;
    }

    const order = await OrdersService.trackOrder(orderNumber, phone);
    sendSuccess(res, order, 'Order status retrieved');
  }

  static async adminGetOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { orders, total } = await OrdersService.adminGetOrders(req.query);
    sendSuccess(res, orders, 'Orders retrieved', 200, {
      total,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
  }

  static async adminUpdateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const orderId = parseInt(req.params.id, 10);
    const { status, trackingNumber, carrierName } = req.body;
    const adminId = req.admin?.adminId;

    await OrdersService.adminUpdateStatus(orderId, status, trackingNumber, carrierName, adminId);
    sendSuccess(res, null, `Order status updated to ${status}`);
  }
}
