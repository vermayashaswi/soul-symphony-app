import React, { useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import NetworkAwareContent from '@/components/NetworkAwareContent';
import { useNetworkStatus } from '@/utils/network';
import HomePage from '@/pages/website/HomePage';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

const Index = () => {
  const isMobile = useIsMobile();
  const networkStatus = useNetworkStatus();
  const { translate } = useTranslation();

  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldRenderMobile = isMobile.isMobile || mobileDemo;
  const isNative = nativeIntegrationService.isRunningNatively();

  // All navigation logic is now handled by AppInitializationContext
  // This component is now passive and only handles pre-translation and rendering

  useEffect(() => {
    // Pre-translate common strings used on the index page
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
    
    preTranslateCommonStrings();
    
    if (networkStatus.speed === 'slow') {
      console.log('[Index] Slow network detected, optimizing experience...');
    }
  }, [networkStatus.speed, translate]);
  
  console.log('[Index] Rendering Index.tsx component, path:', window.location.pathname, { isNative });

  // For native apps, don't render anything as we redirect immediately
  if (isNative) {
    return null;
  }

  // Always render the website homepage component when at root URL (web only)
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
