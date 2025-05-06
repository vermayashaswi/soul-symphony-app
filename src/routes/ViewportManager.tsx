
import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileNavigation from '@/components/MobileNavigation';
import { isAppRoute, isWebsiteRoute } from './RouteHelpers';
import { useOnboarding } from '@/hooks/use-onboarding';
import { TutorialProvider, useTutorial } from '@/contexts/TutorialContext';
import TutorialOverlay from '@/components/tutorial/TutorialOverlay';

// Separate component to use the tutorial hook inside the TutorialProvider
const TutorialManager: React.FC = () => {
  const { user } = useAuth();
  const { resetTutorial } = useTutorial();
  const location = useLocation();
  
  // Check for reset flag from App.tsx
  useEffect(() => {
    const tutorialReset = localStorage.getItem('tutorial_reset_20250506') === 'true';
    
    // Reset tutorial when user logs in or when reset flag is present
    if (user && (tutorialReset || !localStorage.getItem('soulo_tutorial_completed'))) {
      console.log('TutorialManager: Resetting tutorial for user login or by reset flag');
      resetTutorial();
      
      // After resetting, remove the global reset flag to prevent infinite resets
      // This allows the user to dismiss the tutorial if they want
      if (tutorialReset) {
        localStorage.removeItem('tutorial_reset_20250506');
      }
    }
  }, [user, resetTutorial]);
  
  return null;
};

const ViewportManager: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { onboardingComplete } = useOnboarding();
  
  // Debug log to understand route detection
  console.log('ViewportManager - Path:', location.pathname, {
    isAppRoute: isAppRoute(location.pathname),
    isWebsiteRoute: isWebsiteRoute(location.pathname),
    user: !!user
  });

  // Adjust viewport height for mobile devices to handle address bar
  useEffect(() => {
    const setVh = () => {
      // First, get the viewport height and multiply it by 1% to get a value for a vh unit
      const vh = window.innerHeight * 0.01;
      // Then set the value in the --vh custom property to the root of the document
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    // Set the height initially
    setVh();

    // Reset the height whenever the window size changes
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);

    return () => {
      window.removeEventListener('resize', setVh);
      window.removeEventListener('orientationchange', setVh);
    };
  }, []);
  
  // Render the appropriate layout based on route and device
  return (
    <TutorialProvider>
      <TutorialManager />
      <div className="app-container overflow-x-hidden min-h-screen" 
           style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}>
        <Outlet />
      </div>
      
      {/* Display mobile navigation ONLY on actual app routes AND when user is logged in */}
      {isAppRoute(location.pathname) && user && (
        <MobileNavigation 
          onboardingComplete={onboardingComplete} 
        />
      )}
      
      {/* Only render tutorial overlay for app routes */}
      {isAppRoute(location.pathname) && user && (
        <TutorialOverlay />
      )}
    </TutorialProvider>
  );
};

export default ViewportManager;
