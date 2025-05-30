
import { supabase } from '@/integrations/supabase/client';

interface SessionData {
  deviceType: string;
  userAgent: string;
  entryPage: string;
  lastActivePage: string;
  language?: string;
  referrer?: string;
  ipAddress?: string;
}

/**
 * Create or update user session with enhanced tracking
 */
export const createEnhancedUserSession = async (userId: string, sessionData: SessionData): Promise<string | null> => {
  try {
    console.log('Creating enhanced user session for user:', userId);
    
    // Get referrer from document if available
    const referrer = sessionData.referrer || (typeof document !== 'undefined' ? document.referrer : null);
    
    // Detect language from browser if not provided
    const language = sessionData.language || (typeof navigator !== 'undefined' ? navigator.language : 'en');
    
    const { data: sessionId, error } = await supabase
      .rpc('enhanced_manage_user_session', {
        p_user_id: userId,
        p_device_type: sessionData.deviceType,
        p_user_agent: sessionData.userAgent,
        p_entry_page: sessionData.entryPage,
        p_last_active_page: sessionData.lastActivePage,
        p_language: language,
        p_referrer: referrer,
        p_ip_address: sessionData.ipAddress
      });
    
    if (error) {
      console.error('Error creating enhanced user session:', error);
      return null;
    }
    
    console.log('Enhanced user session created successfully with ID:', sessionId);
    return sessionId;
  } catch (e) {
    console.error('Exception creating enhanced user session:', e);
    return null;
  }
};

/**
 * Update session activity with page navigation and language changes
 */
export const updateSessionActivity = async (sessionId: string, page?: string, language?: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .rpc('update_session_activity', {
        p_session_id: sessionId,
        p_page: page,
        p_language: language
      });
    
    if (error) {
      console.error('Error updating session activity:', error);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Exception updating session activity:', e);
    return false;
  }
};

/**
 * Get device type from user agent
 */
export const getDeviceType = (): string => {
  if (typeof navigator === 'undefined') return 'unknown';
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
  
  return isMobile ? 'mobile' : 'desktop';
};

/**
 * Get current page path
 */
export const getCurrentPage = (): string => {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname;
};

/**
 * Get browser language
 */
export const getBrowserLanguage = (): string => {
  if (typeof navigator === 'undefined') return 'en';
  return navigator.language || 'en';
};
