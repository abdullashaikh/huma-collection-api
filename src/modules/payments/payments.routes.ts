import { Router } from 'express';
import { PaymentsController } from './payments.controller';

const router = Router();

router.post('/razorpay/verify', PaymentsController.verifyPayment);
router.post('/razorpay/webhook', PaymentsController.handleWebhook);

export default router;
