
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { useIsMobile } from '@/hooks/use-mobile';
import { isNativeApp } from '@/routes/RouteHelpers';
import { useTutorial } from '@/contexts/TutorialContext';
import MobileNavigation from '@/components/MobileNavigation';

interface MobileNavigationManagerProps {
  user: User | null;
  onboardingComplete: boolean | null;
  onboardingLoading: boolean;
}

const MobileNavigationManager: React.FC<MobileNavigationManagerProps> = ({ 
  user, 
  onboardingComplete, 
  onboardingLoading 
}) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { isActive: isTutorialActive } = useTutorial();
  const [forceRefresh, setForceRefresh] = useState(0);

  // Force refresh when user state changes
  useEffect(() => {
    console.log('MobileNavigationManager: User state changed, forcing refresh');
    setForceRefresh(prev => prev + 1);
  }, [user, onboardingComplete]);

  // Force refresh when location changes to app routes
  useEffect(() => {
    if (location.pathname.startsWith('/app/') && user && onboardingComplete) {
      console.log('MobileNavigationManager: App route with authenticated user, forcing refresh');
      setForceRefresh(prev => prev + 1);
    }
  }, [location.pathname, user, onboardingComplete]);

  const shouldShowNavigation = () => {
    // Don't show during loading
    if (onboardingLoading) return false;
    
    // Don't show if not mobile/native
    if (!isMobile && !isNativeApp()) return false;
    
    // Don't show during tutorial
    if (isTutorialActive) return false;
    
    // Don't show if no user
    if (!user) return false;
    
    // Don't show if onboarding not complete
    if (onboardingComplete === false) return false;
    
    // Don't show on special routes
    const specialRoutes = [
      '/app/onboarding',
      '/app/auth',
      '/onboarding', 
      '/auth',
      '/app',
      '/'
    ];
    
    if (specialRoutes.includes(location.pathname)) return false;
    
    // Show for authenticated app routes
    return location.pathname.startsWith('/app/');
  };

  const visible = shouldShowNavigation();
  
  console.log('MobileNavigationManager visibility:', {
    visible,
    user: !!user,
    onboardingComplete,
    onboardingLoading,
    path: location.pathname,
    forceRefresh
  });

  if (!visible) {
    return null;
  }

  return (
    <MobileNavigation 
      key={`mobile-nav-${forceRefresh}`}
      onboardingComplete={onboardingComplete} 
    />
  );
};

export default MobileNavigationManager;
