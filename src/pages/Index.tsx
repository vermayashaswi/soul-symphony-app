
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnboarding } from '@/hooks/use-onboarding';
import NetworkAwareContent from '@/components/NetworkAwareContent';
import { useNetworkStatus } from '@/utils/network';
import HomePage from '@/pages/website/HomePage';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colorTheme } = useTheme();
  const isMobile = useIsMobile();
  const { onboardingComplete } = useOnboarding();
  const networkStatus = useNetworkStatus();
  const { translate } = useTranslation();

  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldRenderMobile = isMobile.isMobile || mobileDemo;

  // Only handle explicit app redirects
  useEffect(() => {
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
    }
    
    // Check URL parameters for specific app features redirects
    if (urlParams.has('insights')) {
      navigate('/app/insights');
    }
  }, [user, navigate, urlParams, onboardingComplete]);

  // Optional: Pre-translate common strings (but don't block rendering)
  useEffect(() => {
    const preTranslateCommonStrings = async () => {
      if (translate) {
        try {
          console.log('[Index] Pre-translating common strings...');
          await translate("Welcome to Soul Symphony", "en");
          await translate("We've detected you're on a slow connection. We're loading a lightweight version of our site for better performance.", "en");
          await translate("Loading optimized content...", "en");
          await translate("You're currently offline", "en");
          await translate("Please check your connection to access all features. Some content may still be available from cache.", "en");
          console.log('[Index] Pre-translation complete');
        } catch (error) {
          console.error("[Index] Error pre-translating index page strings:", error);
        }
      }
    };
    
    // Don't block the UI for translation pre-loading
    setTimeout(preTranslateCommonStrings, 100);
    
    if (networkStatus.speed === 'slow') {
      console.log('[Index] Slow network detected, optimizing experience...');
    }
  }, [networkStatus.speed, translate]);
  
  console.log('[Index] Rendering Index.tsx component, path:', window.location.pathname, {
    hasUser: !!user,
    onboardingComplete
  });

  // Always render the website homepage component when at root URL
  return (
    <NetworkAwareContent
      lowBandwidthFallback={
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h1 className="text-2xl font-bold mb-4">
            <TranslatableText text="Welcome to Soul Symphony" forceTranslate={true} />
          </h1>
          <p className="text-center mb-6">
            <TranslatableText 
              text="We've detected you're on a slow connection. We're loading a lightweight version of our site for better performance." 
              forceTranslate={true}
            />
          </p>
          <div className="animate-pulse">
            <TranslatableText text="Loading optimized content..." forceTranslate={true} />
          </div>
        </div>
      }
      offlineFallback={
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h1 className="text-2xl font-bold mb-4">
            <TranslatableText text="You're currently offline" forceTranslate={true} />
          </h1>
          <p className="text-center mb-6">
            <TranslatableText 
              text="Please check your connection to access all features. Some content may still be available from cache." 
              forceTranslate={true}
            />
          </p>
        </div>
      }
    >
      <HomePage />
    </NetworkAwareContent>
  );
};

export default Index;
