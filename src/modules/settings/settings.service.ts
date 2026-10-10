import { query } from '../../config/database';

export class SettingsService {
  /**
   * Retrieves public website settings map.
   */
  static async getPublicSettings(): Promise<Record<string, string>> {
    const rows: any = await query('SELECT setting_key, setting_value FROM website_settings');
    const settingsMap: Record<string, string> = {};
    for (const r of rows) {
      settingsMap[r.setting_key] = r.setting_value;
    }
    return settingsMap;
  }

  /**
   * Retrieves active marketing banners.
   */
  static async getBanners(): Promise<any[]> {
    return query(
      'SELECT * FROM banners WHERE is_active = 1 ORDER BY display_order ASC, created_at DESC'
    );
  }

  /**
   * Admin: Update setting keys.
   */
  static async adminUpdateSettings(settings: Record<string, string>): Promise<void> {
    for (const [key, val] of Object.entries(settings)) {
      await query(
        `INSERT INTO website_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
        [key, String(val)]
      );
    }
  }

  /**
   * Admin: List all banners.
   */
  static async adminGetBanners(): Promise<any[]> {
    return query('SELECT * FROM banners ORDER BY display_order ASC, created_at DESC');
  }
}
