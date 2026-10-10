import crypto from 'crypto';
import { query, withTransaction } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/error-handler';

export class PaymentsService {
  /**
   * Verifies Razorpay payment signature using timing-safe HMAC SHA256.
   * Updates Order and Payment atomically and idempotently.
   */
  static async verifyRazorpayPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): Promise<{ orderNumber: string; isSuccess: boolean }> {
    // 1. Verify HMAC SHA256 Signature
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    // Constant-time comparison against timing attacks
    const isSignatureValid =
      expectedSignature.length === razorpaySignature.length &&
      crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpaySignature));

    if (!isSignatureValid) {
      logger.error('Payment signature tampering detected!', {
        razorpayOrderId,
        razorpayPaymentId,
        providedSignature: razorpaySignature,
      });
      throw new AppError('Payment signature verification failed. Potential tampering detected.', 400, 'PAYMENT_TAMPERED');
    }

    return withTransaction(async (conn) => {
      // 2. Fetch payment record
      const [payments]: any = await conn.query(
        'SELECT * FROM payments WHERE gateway_order_id = ? FOR UPDATE',
        [razorpayOrderId]
      );

      if (!payments.length) {
        throw new AppError('Associated payment record not found.', 404, 'PAYMENT_NOT_FOUND');
      }

      const payment = payments[0];
      const orderId = payment.order_id;

      // 3. Idempotency Check: if already marked PAID, return success immediately
      if (payment.status === 'PAID') {
        logger.info(`Payment already marked as PAID for order_id: ${orderId}. Idempotent return.`);
        const [orders]: any = await conn.query('SELECT order_number FROM orders WHERE id = ?', [orderId]);
        return { orderNumber: orders[0]?.order_number, isSuccess: true };
      }

      // 4. Update Payment record to PAID
      await conn.query(
        `UPDATE payments
         SET gateway_payment_id = ?,
             gateway_signature = ?,
             status = 'PAID',
             updated_at = NOW()
         WHERE id = ?`,
        [razorpayPaymentId, razorpaySignature, payment.id]
      );

      // 5. Update Order status to CONFIRMED and payment_status to PAID
      const [orderRes]: any = await conn.query(
        `UPDATE orders
         SET order_status = 'CONFIRMED',
             payment_status = 'PAID',
             updated_at = NOW()
         WHERE id = ?`,
        [orderId]
      );

      // 6. Record payment transaction audit log
      await conn.query(
        `INSERT INTO payment_transactions (
          payment_id, event_type, status, amount, gateway_reference, payload
        ) VALUES (?, 'VERIFY_CLIENT', 'PAID', ?, ?, ?)`,
        [
          payment.id,
          payment.amount,
          razorpayPaymentId,
          JSON.stringify({ razorpayOrderId, razorpayPaymentId, verifiedAt: new Date().toISOString() }),
        ]
      );

      // 7. Update inventory transactions from SALE_HOLD to SALE_DEDUCT
      const [orderData]: any = await conn.query('SELECT order_number FROM orders WHERE id = ?', [orderId]);
      const orderNumber = orderData[0]?.order_number;

      await conn.query(
        `UPDATE inventory_transactions
         SET transaction_type = 'SALE_DEDUCT',
             notes = 'Payment verified via Razorpay'
         WHERE reference_id = ? AND transaction_type = 'SALE_HOLD'`,
        [orderNumber]
      );

      logger.info(`✅ Payment verified & order confirmed: ${orderNumber} (Payment ID: ${razorpayPaymentId})`);

      return { orderNumber, isSuccess: true };
    });
  }

  /**
   * Handles asynchronous webhook notifications from Razorpay server.
   */
  static async handleWebhook(
    rawBody: Buffer | string,
    signatureHeader: string
  ): Promise<{ received: boolean }> {
    if (!signatureHeader) {
      throw new AppError('Missing Razorpay webhook signature header', 400, 'MISSING_SIGNATURE');
    }

    const bodyString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');

    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(bodyString)
      .digest('hex');

    if (expectedSignature !== signatureHeader) {
      logger.error('Invalid Razorpay webhook signature header');
      throw new AppError('Invalid webhook signature', 400, 'INVALID_WEBHOOK_SIGNATURE');
    }

    const event = JSON.parse(bodyString);
    logger.info(`Received Razorpay webhook event: ${event.event}`);

    if (event.event === 'order.paid' || event.event === 'payment.captured') {
      const paymentEntity = event.payload?.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id;
      const rzpPaymentId = paymentEntity?.id;

      if (rzpOrderId && rzpPaymentId) {
        // Idempotent update
        await query(
          `UPDATE payments p
           JOIN orders o ON p.order_id = o.id
           SET p.status = 'PAID',
               p.gateway_payment_id = COALESCE(p.gateway_payment_id, ?),
               o.payment_status = 'PAID',
               o.order_status = CASE WHEN o.order_status = 'PENDING' THEN 'CONFIRMED' ELSE o.order_status END
           WHERE p.gateway_order_id = ? AND p.status != 'PAID'`,
          [rzpPaymentId, rzpOrderId]
        );
      }
    }

    return { received: true };
  }
}
