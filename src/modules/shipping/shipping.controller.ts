import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { ShippingService } from './shipping.service';

export class ShippingController {
  static async checkPincode(req: Request, res: Response): Promise<void> {
    const pincode = req.params.pincode;
    const subtotal = parseFloat(req.query.subtotal as string) || 0;
    const info = await ShippingService.getPincodeDeliveryInfo(pincode, subtotal);
    sendSuccess(res, info, 'Pincode delivery details verified');
  }
}
