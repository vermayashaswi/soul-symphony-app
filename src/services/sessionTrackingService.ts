import { supabase } from "@/integrations/supabase/client";

export class SessionTrackingService {
  private static instance: SessionTrackingService;

  static getInstance(): SessionTrackingService {
    if (!SessionTrackingService.instance) {
      SessionTrackingService.instance = new SessionTrackingService();
    }
    return SessionTrackingService.instance;
  }

  static async detectLocation(): Promise<any> {
    try {
      // Basic location detection using browser geolocation API
      if (!navigator.geolocation) {
        return { country: 'unknown', city: 'unknown', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      }

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              accuracy: position.coords.accuracy
            });
          },
          () => {
            // Fallback to timezone only if geolocation fails
            resolve({
              country: 'unknown',
              city: 'unknown',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            });
          },
          { timeout: 5000, maximumAge: 300000 } // 5 seconds timeout, cache for 5 minutes
        );
      });
    } catch (error) {
      console.error('[SessionTrackingService] Error detecting location:', error);
      return {
        country: 'unknown',
        city: 'unknown',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
    }
  }

  static extractUtmParameters(): any {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return {
        utm_source: urlParams.get('utm_source'),
        utm_medium: urlParams.get('utm_medium'),
        utm_campaign: urlParams.get('utm_campaign'),
        utm_term: urlParams.get('utm_term'),
        utm_content: urlParams.get('utm_content'),
        referrer: document.referrer || null
      };
    } catch (error) {
      console.error('[SessionTrackingService] Error extracting UTM parameters:', error);
      return {};
    }
  }

  static async trackConversion(eventType?: string, eventData?: any, userId?: string): Promise<void> {
    try {
      if (!eventType) return;

      console.log(`[SessionTrackingService] Tracking conversion: ${eventType}`, { eventData, userId });

      // For now, just log the conversion. In a real implementation, you might:
      // 1. Send to analytics service
      // 2. Store in database
      // 3. Send to conversion tracking APIs
      
      // Store basic conversion data if we have user context
      if (userId) {
        const { error } = await supabase
          .from('user_sessions')
          .update({
            last_activity: new Date().toISOString(),
            // Could add conversion tracking fields to the session table if needed
          })
          .eq('user_id', userId)
          .eq('is_active', true);

        if (error) {
          console.error('[SessionTrackingService] Error updating session for conversion:', error);
        }
      }
    } catch (error) {
      console.error('[SessionTrackingService] Error tracking conversion:', error);
    }
  }

  async trackPageView(): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      console.log('[SessionTrackingService] Tracking page view for:', window.location.pathname);

      // Update page view in current active session
      const { error } = await supabase
        .from('user_sessions')
        .update({
          last_activity: new Date().toISOString(),
          last_active_page: window.location.pathname
        })
        .eq('user_id', user.user.id)
        .eq('is_active', true);

      if (error) {
        console.error('[SessionTrackingService] Error tracking page view:', error);
      }
    } catch (error) {
      console.error('[SessionTrackingService] Error in trackPageView:', error);
    }
  }

  async recordConversion(): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      await SessionTrackingService.trackConversion('page_conversion', {
        page: window.location.pathname,
        timestamp: new Date().toISOString()
      }, user.user.id);
    } catch (error) {
      console.error('[SessionTrackingService] Error recording conversion:', error);
    }
  }

  async getAnalytics(): Promise<any> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;

      // Get basic session analytics
      const { data: sessions, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('[SessionTrackingService] Error getting analytics:', error);
        return null;
      }

      return {
        totalSessions: sessions?.length || 0,
        recentSessions: sessions || [],
        lastSession: sessions?.[0] || null
      };
    } catch (error) {
      console.error('[SessionTrackingService] Error in getAnalytics:', error);
      return null;
    }
  }
}

export const sessionTrackingService = SessionTrackingService.getInstance();