
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileNavbar from '@/components/mobile/MobileNavbar';
import { isNativeApp } from './RouteHelpers';

interface MobileNavigationProps {
  onboardingComplete: boolean | null;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ onboardingComplete }) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldShowMobileNav = isMobile || mobileDemo;
  const isOnboardingRoute = location.pathname === '/onboarding';
  const shouldShowOnboarding = !onboardingComplete;
  
  if (shouldShowMobileNav && !shouldShowOnboarding && !isOnboardingRoute && isNativeApp()) {
    return <MobileNavbar />;
  }
  
  return null;
};

export default MobileNavigation;
