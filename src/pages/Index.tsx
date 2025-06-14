
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnboarding } from '@/hooks/use-onboarding';
import HomePage from '@/pages/website/HomePage';
import { forceEnableScrolling } from '@/hooks/use-scroll-restoration';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { onboardingComplete } = useOnboarding();

  console.log('[Index] Rendering Index component at root path "/"', {
    hasUser: !!user,
    onboardingComplete,
    pathname: window.location.pathname
  });

  // Force enable scrolling for website
  useEffect(() => {
    console.log('[Index] Ensuring scrolling is enabled for website');
    forceEnableScrolling();
  }, []);

  // Only handle explicit app redirects via URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Only redirect to app if explicitly requested with a URL parameter
    if (urlParams.has('app')) {
      console.log('[Index] User explicitly requested app with ?app parameter');
      
      if (user) {
        console.log('[Index] User is logged in, redirecting to appropriate app page');
        if (onboardingComplete) {
          navigate('/app/home');
        } else {
          navigate('/app/onboarding');
        }
      } else {
        navigate('/app/auth');
      }
      return;
    }
    
    // Check URL parameters for specific app features redirects
    if (urlParams.has('insights')) {
      navigate('/app/insights');
      return;
    }
  }, [user, navigate, onboardingComplete]);

  console.log('[Index] Rendering HomePage component for root URL');
  
  // Always render the website homepage when at root URL - no wrappers that could cause issues
  return <HomePage />;
};

export default Index;
