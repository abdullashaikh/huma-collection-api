import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess } from '../../utils/response';
import { SettingsService } from './settings.service';

export class SettingsController {
  static async getSettings(_req: Request, res: Response): Promise<void> {
    const settings = await SettingsService.getPublicSettings();
    sendSuccess(res, settings, 'Settings retrieved');
  }

  static async getBanners(_req: Request, res: Response): Promise<void> {
    const banners = await SettingsService.getBanners();
    sendSuccess(res, banners, 'Banners retrieved');
  }

  static async adminUpdateSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    await SettingsService.adminUpdateSettings(req.body);
    sendSuccess(res, null, 'Settings updated successfully');
  }

  static async adminGetBanners(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const banners = await SettingsService.adminGetBanners();
    sendSuccess(res, banners, 'Admin banners retrieved');
  }
}
