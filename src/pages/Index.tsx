
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
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
  const networkStatus = useNetworkStatus();
  const { translate } = useTranslation();

  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldRenderMobile = isMobile.isMobile || mobileDemo;

  // Only handle explicit app redirects via URL parameters
  useEffect(() => {
    console.log('Index: Checking URL parameters:', Object.fromEntries(urlParams.entries()));
    
    // Only redirect if explicitly requested via URL parameters
    if (urlParams.has('app') && user) {
      console.log('Index: Explicit app redirect requested');
      navigate('/app/home');
    } else if (urlParams.has('insights')) {
      console.log('Index: Insights redirect requested');
      navigate('/app/insights');
    }
  }, [user, navigate, urlParams]);

  useEffect(() => {
    // Pre-translate common strings for better performance
    const preTranslateStrings = async () => {
      if (translate) {
        try {
          await Promise.all([
            translate("Welcome to Soul Symphony", "en"),
            translate("We've detected you're on a slow connection. We're loading a lightweight version of our site for better performance.", "en"),
            translate("Loading optimized content...", "en"),
            translate("You're currently offline", "en"),
            translate("Please check your connection to access all features. Some content may still be available from cache.", "en")
          ]);
          console.log('Index: Pre-translation complete');
        } catch (error) {
          console.error("Index: Pre-translation error:", error);
        }
      }
    };
    
    preTranslateStrings();
  }, [translate]);
  
  console.log('Index: Rendering marketing homepage at:', window.location.pathname);

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
