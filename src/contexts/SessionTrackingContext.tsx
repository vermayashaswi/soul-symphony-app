import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useSessionTracking } from '@/hooks/useSessionTracking';

interface SessionTrackingContextType {
  trackInteraction: (action?: string) => void;
  trackPageInteraction: (page: string, action?: string) => void;
  getSessionStats: () => any;
  getCurrentSessionId: () => string | null;
}

const SessionTrackingContext = createContext<SessionTrackingContextType | undefined>(undefined);

interface SessionTrackingProviderProps {
  children: ReactNode;
}

export const SessionTrackingProvider: React.FC<SessionTrackingProviderProps> = ({ children }) => {
  const sessionTracking = useSessionTracking();

  // Add global click tracking for interactions
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      // Track clicks on interactive elements
      const target = event.target as HTMLElement;
      if (target) {
        const tagName = target.tagName.toLowerCase();
        const isInteractive = ['button', 'a', 'input', 'select', 'textarea'].includes(tagName) ||
                             target.getAttribute('role') === 'button' ||
                             target.onclick !== null ||
                             target.style.cursor === 'pointer';
        
        if (isInteractive) {
          const action = `${tagName}_click`;
          sessionTracking.trackInteraction(action);
        }
      }
    };

    // Add global scroll tracking (throttled)
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        sessionTracking.trackInteraction('scroll');
      }, 1000); // Throttle scroll events
    };

    // Add focus tracking for form elements
    const handleFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (target && ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase())) {
        sessionTracking.trackInteraction('form_focus');
      }
    };

    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('focus', handleFocus, true);

    return () => {
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('scroll', handleScroll);
      document.removeEventListener('focus', handleFocus, true);
      clearTimeout(scrollTimeout);
    };
  }, [sessionTracking]);

  return (
    <SessionTrackingContext.Provider value={sessionTracking}>
      {children}
    </SessionTrackingContext.Provider>
  );
};

export const useSessionTrackingContext = (): SessionTrackingContextType => {
  const context = useContext(SessionTrackingContext);
  if (context === undefined) {
    throw new Error('useSessionTrackingContext must be used within a SessionTrackingProvider');
  }
  return context;
};