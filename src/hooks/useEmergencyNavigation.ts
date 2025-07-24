import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface EmergencyNavigationOptions {
  maxStuckTime?: number;
  recoveryPath?: string;
}

export const useEmergencyNavigation = (options: EmergencyNavigationOptions = {}) => {
  const { maxStuckTime = 10000, recoveryPath = '/app/home' } = options;
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const stuckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPathRef = useRef<string>('');
  const pathChangeCountRef = useRef<number>(0);

  useEffect(() => {
    // Clear any existing timer
    if (stuckTimerRef.current) {
      clearTimeout(stuckTimerRef.current);
    }

    // Track path changes
    if (lastPathRef.current !== location.pathname) {
      lastPathRef.current = location.pathname;
      pathChangeCountRef.current = 0; // Reset counter on successful navigation
    } else {
      pathChangeCountRef.current++;
    }

    // If we're on the same path for too long, initiate recovery
    if (pathChangeCountRef.current > 2) {
      console.log('[EmergencyNav] Detected potential stuck state, starting recovery timer');
      
      stuckTimerRef.current = setTimeout(() => {
        console.log('[EmergencyNav] Emergency navigation triggered, recovering to:', recoveryPath);
        
        // Force navigation to recovery path
        if (user) {
          navigate(recoveryPath, { replace: true });
        } else {
          navigate('/app/onboarding', { replace: true });
        }
      }, maxStuckTime);
    }

    return () => {
      if (stuckTimerRef.current) {
        clearTimeout(stuckTimerRef.current);
      }
    };
  }, [location.pathname, navigate, user, maxStuckTime, recoveryPath]);

  const forceRecovery = (path?: string) => {
    console.log('[EmergencyNav] Force recovery triggered');
    navigate(path || recoveryPath, { replace: true });
  };

  return { forceRecovery };
};