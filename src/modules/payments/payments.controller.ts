import { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import { PaymentsService } from './payments.service';

const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(5),
  razorpayPaymentId: z.string().min(5),
  razorpaySignature: z.string().min(10),
});

export class PaymentsController {
  static async verifyPayment(req: Request, res: Response): Promise<void> {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = verifyPaymentSchema.parse(req.body);
    const result = await PaymentsService.verifyRazorpayPayment(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    sendSuccess(res, result, 'Payment verified successfully! Your order has been placed.');
  }

  static async handleWebhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = req.body;
    await PaymentsService.handleWebhook(rawBody, signature);
    res.status(200).json({ status: 'ok' });
  }
}
