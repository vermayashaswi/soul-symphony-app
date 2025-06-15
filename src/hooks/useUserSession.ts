
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { UserSessionService } from '@/services/userSessionService';

export function useUserSession() {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;

    // Get device and session info
    const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
    const urlParams = new URLSearchParams(window.location.search);
    
    const sessionData = {
      deviceType,
      userAgent: navigator.userAgent,
      entryPage: location.pathname,
      lastActivePage: location.pathname,
      language: navigator.language || 'en',
      referrer: document.referrer || undefined,
      utmSource: urlParams.get('utm_source') || undefined,
      utmMedium: urlParams.get('utm_medium') || undefined,
      utmCampaign: urlParams.get('utm_campaign') || undefined,
      utmTerm: urlParams.get('utm_term') || undefined,
      utmContent: urlParams.get('utm_content') || undefined,
      gclid: urlParams.get('gclid') || undefined,
      fbclid: urlParams.get('fbclid') || undefined,
    };

    UserSessionService.initializeSession(user.id, sessionData);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    UserSessionService.updatePageActivity(location.pathname);
  }, [location.pathname, user]);

  return {
    trackConversion: UserSessionService.trackConversion,
    updatePageActivity: UserSessionService.updatePageActivity,
    sessionId: UserSessionService.getSessionId(),
  };
}
