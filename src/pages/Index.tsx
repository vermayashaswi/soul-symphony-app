
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NetworkAwareContent from '@/components/NetworkAwareContent';
import { useNetworkStatus } from '@/utils/network';
import HomePage from '@/pages/website/HomePage';
import { MarketingTranslatableText } from '@/components/marketing/MarketingTranslatableText';
import { forceEnableScrolling } from '@/hooks/use-scroll-restoration';

const Index = () => {
  const navigate = useNavigate();
  const networkStatus = useNetworkStatus();

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

  useEffect(() => {
    // Ensure scrolling is always enabled on marketing
    forceEnableScrolling();
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.body.style.top = '';
    document.body.style.left = '';
  }, []);

  console.log('[Index] Rendering marketing homepage');

  return (
    <>
      <NetworkAwareContent
        lowBandwidthFallback={
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-4">
              <MarketingTranslatableText text="Welcome to SOULo" />
            </h1>
            <p className="text-center mb-6">
              <MarketingTranslatableText 
                text="We've detected you're on a slow connection. We're loading a lightweight version of our site for better performance." 
              />
            </p>
            <div className="animate-pulse">
              <MarketingTranslatableText text="Loading optimized content..." />
            </div>
          </div>
        }
        offlineFallback={
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-4">
              <MarketingTranslatableText text="You're currently offline" />
            </h1>
            <p className="text-center mb-6">
              <MarketingTranslatableText 
                text="Please check your connection to access all features. Some content may still be available from cache." 
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
