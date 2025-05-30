
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { createEnhancedUserSession, updateSessionActivity, getDeviceType, getCurrentPage, getBrowserLanguage } from '@/services/sessionService';
import { useTranslation } from 'react-i18next';

export const useSessionTracking = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { i18n } = useTranslation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const previousLanguage = useRef<string>(i18n.language);
  const sessionCreated = useRef<boolean>(false);

  // Create session when user is authenticated
  useEffect(() => {
    const createSession = async () => {
      if (!user || sessionCreated.current || sessionId) return;
      
      try {
        const deviceType = getDeviceType();
        const currentPage = getCurrentPage();
        const browserLanguage = getBrowserLanguage();
        
        const newSessionId = await createEnhancedUserSession(user.id, {
          deviceType,
          userAgent: navigator.userAgent,
          entryPage: currentPage,
          lastActivePage: currentPage,
          language: i18n.language || browserLanguage,
          referrer: document.referrer
        });
        
        if (newSessionId) {
          setSessionId(newSessionId);
          setIsSessionActive(true);
          sessionCreated.current = true;
          console.log('Session tracking initialized with ID:', newSessionId);
        }
      } catch (error) {
        console.error('Error creating session:', error);
      }
    };

    createSession();
  }, [user, i18n.language]);

  // Track page navigation
  useEffect(() => {
    if (!sessionId || !isSessionActive) return;
    
    const updatePageVisit = async () => {
      try {
        await updateSessionActivity(sessionId, location.pathname);
        console.log('Page visit tracked:', location.pathname);
      } catch (error) {
        console.error('Error tracking page visit:', error);
      }
    };

    updatePageVisit();
  }, [location.pathname, sessionId, isSessionActive]);

  // Track language changes
  useEffect(() => {
    if (!sessionId || !isSessionActive) return;
    
    const trackLanguageChange = async () => {
      if (previousLanguage.current !== i18n.language) {
        try {
          await updateSessionActivity(sessionId, undefined, i18n.language);
          console.log('Language change tracked:', i18n.language);
          previousLanguage.current = i18n.language;
        } catch (error) {
          console.error('Error tracking language change:', error);
        }
      }
    };

    trackLanguageChange();
  }, [i18n.language, sessionId, isSessionActive]);

  // Clean up session on unmount
  useEffect(() => {
    return () => {
      if (sessionId && isSessionActive) {
        // Session will be automatically closed by the database function
        console.log('Session tracking cleanup');
      }
    };
  }, [sessionId, isSessionActive]);

  return {
    sessionId,
    isSessionActive,
    trackPageVisit: (page: string) => {
      if (sessionId && isSessionActive) {
        updateSessionActivity(sessionId, page);
      }
    },
    trackLanguageChange: (language: string) => {
      if (sessionId && isSessionActive) {
        updateSessionActivity(sessionId, undefined, language);
      }
    }
  };
};
