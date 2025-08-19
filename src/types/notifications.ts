// Unified notification types for consistent data structure across frontend and backend

export type JournalReminderTime = 'morning' | 'afternoon' | 'evening' | 'night';

export interface CustomReminderTime {
  id: string;
  label: string;
  hour: number;
  minute: number;
  enabled: boolean;
}

// Database-compatible notification settings (matches profiles.reminder_settings)
export interface NotificationSettings {
  enabled?: boolean;
  morning?: boolean;
  afternoon?: boolean;
  evening?: boolean;
  night?: boolean;
  morningTime?: string;    // "08:00"
  afternoonTime?: string;  // "14:00"
  eveningTime?: string;    // "19:00"
  nightTime?: string;      // "22:00"
  customTimes?: CustomReminderTime[];
  lastUpdated?: string;
}

// Simplified settings for service layer
export interface ServiceReminderSettings {
  enabled: boolean;
  times: JournalReminderTime[];
  customTimes?: CustomReminderTime[];
  lastUpdated?: string;
}

// Convert database format to service format
export function convertToServiceSettings(dbSettings: NotificationSettings): ServiceReminderSettings {
  const times: JournalReminderTime[] = [];
  
  if (dbSettings.morning) times.push('morning');
  if (dbSettings.afternoon) times.push('afternoon');
  if (dbSettings.evening) times.push('evening');
  if (dbSettings.night) times.push('night');
  
  return {
    enabled: dbSettings.enabled || false,
    times,
    customTimes: dbSettings.customTimes || [],
    lastUpdated: dbSettings.lastUpdated
  };
}

// Convert service format to database format
export function convertToDbSettings(serviceSettings: ServiceReminderSettings, customTimes?: { [key in JournalReminderTime]: string }): NotificationSettings {
  const dbSettings: NotificationSettings = {
    enabled: serviceSettings.enabled,
    morning: serviceSettings.times.includes('morning'),
    afternoon: serviceSettings.times.includes('afternoon'),
    evening: serviceSettings.times.includes('evening'),
    night: serviceSettings.times.includes('night'),
    morningTime: customTimes?.morning || '08:00',
    afternoonTime: customTimes?.afternoon || '14:00',
    eveningTime: customTimes?.evening || '19:00',
    nightTime: customTimes?.night || '22:00',
    customTimes: serviceSettings.customTimes || [],
    lastUpdated: new Date().toISOString()
  };
  
  return dbSettings;
}

export const DEFAULT_TIME_MAPPINGS: Record<JournalReminderTime, { hour: number; minute: number; label: string }> = {
  morning: { hour: 8, minute: 0, label: 'Morning' },
  afternoon: { hour: 14, minute: 0, label: 'Afternoon' },
  evening: { hour: 19, minute: 0, label: 'Evening' },
  night: { hour: 22, minute: 0, label: 'Night' }
};