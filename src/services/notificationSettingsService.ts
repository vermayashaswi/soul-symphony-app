import { supabase } from '@/integrations/supabase/client';
import { 
  NotificationSettings, 
  ServiceReminderSettings, 
  convertToServiceSettings, 
  convertToDbSettings,
  JournalReminderTime,
  DEFAULT_TIME_MAPPINGS
} from '@/types/notifications';

class NotificationSettingsService {
  private static instance: NotificationSettingsService;
  private cache: NotificationSettings | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): NotificationSettingsService {
    if (!NotificationSettingsService.instance) {
      NotificationSettingsService.instance = new NotificationSettingsService();
    }
    return NotificationSettingsService.instance;
  }

  private log(message: string, data?: any): void {
    console.log(`[NotificationSettingsService] ${message}`, data);
  }

  private error(message: string, error?: any): void {
    console.error(`[NotificationSettingsService] ${message}`, error);
  }

  private isValidCache(): boolean {
    return this.cache !== null && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  // Load settings from Supabase with localStorage fallback
  async loadSettings(): Promise<ServiceReminderSettings> {
    this.log('Loading notification settings');

    try {
      // Check cache first
      if (this.isValidCache() && this.cache) {
        this.log('Using cached settings');
        return convertToServiceSettings(this.cache);
      }

      // Try to load from Supabase
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('reminder_settings')
          .eq('id', user.id)
          .single();

        if (error) {
          this.error('Error loading settings from database:', error);
        } else if (profile?.reminder_settings) {
          const dbSettings = profile.reminder_settings as NotificationSettings;
          this.cache = dbSettings;
          this.cacheTimestamp = Date.now();
          this.log('Settings loaded from database:', dbSettings);
          
          // Sync to localStorage for offline access
          this.syncToLocalStorage(dbSettings);
          
          return convertToServiceSettings(dbSettings);
        }
      }

      // Fallback to localStorage
      this.log('Falling back to localStorage');
      return this.loadFromLocalStorage();

    } catch (error) {
      this.error('Error loading settings:', error);
      return this.loadFromLocalStorage();
    }
  }

  // Save settings to both Supabase and localStorage
  async saveSettings(settings: ServiceReminderSettings, customTimes?: { [key in JournalReminderTime]: string }): Promise<boolean> {
    this.log('Saving notification settings:', settings);

    try {
      const dbSettings = convertToDbSettings(settings, customTimes);
      
      // Save to localStorage immediately
      this.syncToLocalStorage(dbSettings);
      
      // Try to save to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .update({ 
            reminder_settings: dbSettings as any,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (error) {
          this.error('Error saving to database:', error);
          return false;
        } else {
          this.log('Settings saved to database successfully');
          this.cache = dbSettings;
          this.cacheTimestamp = Date.now();
          return true;
        }
      } else {
        this.log('No authenticated user, saved to localStorage only');
        return true;
      }

    } catch (error) {
      this.error('Error saving settings:', error);
      return false;
    }
  }

  // Get custom time for a reminder type
  getCustomTime(settings: NotificationSettings, reminderTime: JournalReminderTime): { hour: number; minute: number } {
    const timeMap = {
      morning: settings.morningTime || '08:00',
      afternoon: settings.afternoonTime || '14:00', 
      evening: settings.eveningTime || '19:00',
      night: settings.nightTime || '22:00'
    };

    const timeStr = timeMap[reminderTime];
    const [hourStr, minuteStr] = timeStr.split(':');
    
    return {
      hour: parseInt(hourStr, 10),
      minute: parseInt(minuteStr, 10)
    };
  }

  // Update custom time for a reminder type
  async updateCustomTime(reminderTime: JournalReminderTime, hour: number, minute: number): Promise<boolean> {
    try {
      const settings = await this.loadSettings();
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      const customTimes = {
        morning: '08:00',
        afternoon: '14:00',
        evening: '19:00',
        night: '22:00'
      };
      
      // Load current custom times from database
      const currentSettings = await this.loadFullSettings();
      if (currentSettings) {
        customTimes.morning = currentSettings.morningTime || '08:00';
        customTimes.afternoon = currentSettings.afternoonTime || '14:00';
        customTimes.evening = currentSettings.eveningTime || '19:00';
        customTimes.night = currentSettings.nightTime || '22:00';
      }
      
      customTimes[reminderTime] = timeStr;
      
      return await this.saveSettings(settings, customTimes);
    } catch (error) {
      this.error('Error updating custom time:', error);
      return false;
    }
  }

  // Load full settings including custom times
  private async loadFullSettings(): Promise<NotificationSettings | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('reminder_settings')
          .eq('id', user.id)
          .single();

        if (!error && profile?.reminder_settings) {
          return profile.reminder_settings as NotificationSettings;
        }
      }
      return null;
    } catch (error) {
      this.error('Error loading full settings:', error);
      return null;
    }
  }

  // Sync settings to localStorage
  private syncToLocalStorage(settings: NotificationSettings): void {
    try {
      const serviceSettings = convertToServiceSettings(settings);
      
      localStorage.setItem('journal_reminder_enabled', serviceSettings.enabled.toString());
      localStorage.setItem('journal_reminder_times', JSON.stringify(serviceSettings.times));
      localStorage.setItem('journal_reminder_settings_full', JSON.stringify(settings));
      
      if (serviceSettings.lastUpdated) {
        localStorage.setItem('journal_reminder_last_updated', serviceSettings.lastUpdated);
      }
      
      this.log('Settings synced to localStorage');
    } catch (error) {
      this.error('Error syncing to localStorage:', error);
    }
  }

  // Load from localStorage only
  private loadFromLocalStorage(): ServiceReminderSettings {
    try {
      // Try to load full settings first
      const fullSettingsStr = localStorage.getItem('journal_reminder_settings_full');
      if (fullSettingsStr) {
        const fullSettings = JSON.parse(fullSettingsStr) as NotificationSettings;
        return convertToServiceSettings(fullSettings);
      }

      // Fallback to old format
      const enabled = localStorage.getItem('journal_reminder_enabled') === 'true';
      const timesStr = localStorage.getItem('journal_reminder_times');
      const lastUpdated = localStorage.getItem('journal_reminder_last_updated') || undefined;
      
      let times: JournalReminderTime[] = [];
      if (timesStr) {
        try {
          times = JSON.parse(timesStr);
        } catch (error) {
          this.error('Error parsing saved times:', error);
        }
      }
      
      return { enabled, times, lastUpdated };
    } catch (error) {
      this.error('Error loading from localStorage:', error);
      return { enabled: false, times: [] };
    }
  }

  // Clear all settings
  async clearSettings(): Promise<void> {
    this.log('Clearing notification settings');
    
    try {
      // Clear localStorage
      localStorage.removeItem('journal_reminder_enabled');
      localStorage.removeItem('journal_reminder_times');
      localStorage.removeItem('journal_reminder_last_updated');
      localStorage.removeItem('journal_reminder_settings_full');
      
      // Clear cache
      this.cache = null;
      this.cacheTimestamp = 0;
      
      // Clear database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ 
            reminder_settings: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }
      
      this.log('Settings cleared successfully');
    } catch (error) {
      this.error('Error clearing settings:', error);
    }
  }
}

export const notificationSettingsService = NotificationSettingsService.getInstance();