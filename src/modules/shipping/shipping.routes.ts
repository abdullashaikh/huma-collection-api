import { Router } from 'express';
import { ShippingController } from './shipping.controller';

const router = Router();

router.get('/pincode/:pincode', ShippingController.checkPincode);

export default router;
