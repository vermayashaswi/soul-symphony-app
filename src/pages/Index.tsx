
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// DO NOT import useAuth, useTheme, useOnboarding except on /app pages
// import { useAuth } from '@/contexts/AuthContext';
// import { useTheme } from '@/hooks/use-theme';
// import { useOnboarding } from '@/hooks/use-onboarding';
import NetworkAwareContent from '@/components/NetworkAwareContent';
import { useNetworkStatus } from '@/utils/network';
import HomePage from '@/pages/website/HomePage';
import { TranslatableText } from '@/components/translation/TranslatableText';
// import { useTranslation } from '@/contexts/TranslationContext';
// import { supabase } from '@/integrations/supabase/client';

// No contexts, so all hooks must be safe to run outside app context

const Index = () => {
  const navigate = useNavigate();
  // const { user } = useAuth(); // NOT USED on marketing page
  // const { colorTheme } = useTheme();
  // const isMobile = useIsMobile();
  // const { onboardingComplete, checkOnboardingStatus } = useOnboarding();
  const networkStatus = useNetworkStatus();
  // const { translate } = useTranslation();

  // Only demo: allow ?mobileDemo for HomePage
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';

  // Minimal effect for demo: handle redirects ONLY on defined urlParams
  useEffect(() => {
    if (urlParams.has('app')) {
      navigate('/app/home');
    }
    if (urlParams.has('insights')) {
      navigate('/app/insights');
    }
  }, [navigate, urlParams]);

  // No translation or onboarding logic – all must go through app routes

  return (
    <>
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
    </>
  );
};

export default Index;
