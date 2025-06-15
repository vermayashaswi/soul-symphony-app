
import { supabase } from '@/integrations/supabase/client';

interface SessionData {
  deviceType: string;
  userAgent: string;
  entryPage: string;
  lastActivePage: string;
  language?: string;
  referrer?: string;
  ipAddress?: string;
  countryCode?: string;
  currency?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  gclid?: string;
  fbclid?: string;
  attributionData?: any;
}

export class UserSessionService {
  private static sessionId: string | null = null;

  static async initializeSession(userId: string, sessionData: SessionData): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('enhanced_manage_user_session', {
        p_user_id: userId,
        p_device_type: sessionData.deviceType,
        p_user_agent: sessionData.userAgent,
        p_entry_page: sessionData.entryPage,
        p_last_active_page: sessionData.lastActivePage,
        p_language: sessionData.language || 'en',
        p_referrer: sessionData.referrer,
        p_ip_address: sessionData.ipAddress,
        p_country_code: sessionData.countryCode,
        p_currency: sessionData.currency,
        p_utm_source: sessionData.utmSource,
        p_utm_medium: sessionData.utmMedium,
        p_utm_campaign: sessionData.utmCampaign,
        p_utm_term: sessionData.utmTerm,
        p_utm_content: sessionData.utmContent,
        p_gclid: sessionData.gclid,
        p_fbclid: sessionData.fbclid,
        p_attribution_data: sessionData.attributionData || {}
      });

      if (error) {
        console.error('Session initialization error:', error);
        return null;
      }

      this.sessionId = data;
      return data;
    } catch (error) {
      console.error('Failed to initialize session:', error);
      return null;
    }
  }

  static async trackConversion(eventType: string, eventData: any = {}): Promise<void> {
    if (!this.sessionId) {
      console.warn('No active session to track conversion');
      return;
    }

    try {
      const { error } = await supabase.rpc('track_conversion_event', {
        p_session_id: this.sessionId,
        p_event_type: eventType,
        p_event_data: eventData
      });

      if (error) {
        console.error('Conversion tracking error:', error);
      }
    } catch (error) {
      console.error('Failed to track conversion:', error);
    }
  }

  static async updatePageActivity(lastActivePage: string): Promise<void> {
    if (!this.sessionId) return;

    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ 
          last_active_page: lastActivePage,
          last_activity: new Date().toISOString(),
          page_views: supabase.raw('page_views + 1')
        })
        .eq('id', this.sessionId);

      if (error) {
        console.error('Page activity update error:', error);
      }
    } catch (error) {
      console.error('Failed to update page activity:', error);
    }
  }

  static getSessionId(): string | null {
    return this.sessionId;
  }
}
