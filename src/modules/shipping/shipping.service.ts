import { query } from '../../config/database';
import { AppError } from '../../middleware/error-handler';

export class ShippingService {
  /**
   * Validates a 6-digit Indian pincode and calculates delivery window, COD eligibility, and rates.
   */
  static async getPincodeDeliveryInfo(pincode: string, orderSubtotal: number = 0): Promise<{
    pincode: string;
    isDeliverable: boolean;
    estimatedDelivery: string;
    estimatedDaysMin: number;
    estimatedDaysMax: number;
    shippingCharge: number;
    freeShippingThreshold: number;
    isFreeShipping: boolean;
    codAvailable: boolean;
    codCharge: number;
    carrier: string;
  }> {
    const cleanPincode = pincode.trim();
    if (!/^[1-9][0-9]{5}$/.test(cleanPincode)) {
      throw new AppError('Please enter a valid 6-digit Indian postal pincode.', 400, 'INVALID_PINCODE');
    }

    const methods: any = await query(
      `SELECT sm.*, sz.zone_name
       FROM shipping_methods sm
       JOIN shipping_zones sz ON sm.zone_id = sz.id
       WHERE sm.is_active = 1 AND sz.is_active = 1
       LIMIT 1`
    );

    if (!methods.length) {
      throw new AppError('Shipping service is currently undergoing scheduled maintenance.', 503, 'SHIPPING_UNAVAILABLE');
    }

    const method = methods[0];
    const freeThreshold = parseFloat(method.free_shipping_threshold);
    const isFree = orderSubtotal >= freeThreshold && orderSubtotal > 0;
    const shippingCharge = isFree ? 0 : parseFloat(method.base_charge);
    const codCharge = parseFloat(method.cod_charge);

    // Compute estimated delivery date strings
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + method.estimated_days_min);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + method.estimated_days_max);

    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const dateFormatted = `${minDate.toLocaleDateString('en-IN', options)} - ${maxDate.toLocaleDateString('en-IN', options)}`;

    return {
      pincode: cleanPincode,
      isDeliverable: true,
      estimatedDelivery: dateFormatted,
      estimatedDaysMin: method.estimated_days_min,
      estimatedDaysMax: method.estimated_days_max,
      shippingCharge,
      freeShippingThreshold: freeThreshold,
      isFreeShipping: isFree,
      codAvailable: Boolean(method.cod_available),
      codCharge,
      carrier: 'BlueDart / Delhivery Express',
    };
  }
}
