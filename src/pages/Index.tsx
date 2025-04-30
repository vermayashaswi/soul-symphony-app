
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

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colorTheme } = useTheme();
  const isMobile = useIsMobile();
  const { resetOnboarding } = useOnboarding();
  const networkStatus = useNetworkStatus();

  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldRenderMobile = isMobile.isMobile || mobileDemo;

  useEffect(() => {
    if (networkStatus.speed === 'slow') {
      console.log('Slow network detected, optimizing experience...');
    }
  }, [networkStatus.speed]);
  
  // Add a specific log to track if this component is properly rendering
  console.log('Rendering Index.tsx component');

  return (
    <>
      <NetworkAwareContent
        lowBandwidthFallback={
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-4">
              <TranslatableText text="Welcome to Soul Symphony" />
            </h1>
            <p className="text-center mb-6">
              <TranslatableText text="We've detected you're on a slow connection. We're loading a lightweight version of our site for better performance." />
            </p>
            <div className="animate-pulse">
              <TranslatableText text="Loading optimized content..." />
            </div>
          </div>
        }
        offlineFallback={
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-4">
              <TranslatableText text="You're currently offline" />
            </h1>
            <p className="text-center mb-6">
              <TranslatableText text="Please check your connection to access all features. Some content may still be available from cache." />
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
