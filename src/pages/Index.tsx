import React, { useEffect, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/hooks/use-onboarding';
import Navbar from '@/components/Navbar';
import NetworkAwareContent from '@/components/NetworkAwareContent';
import { useNetworkStatus } from '@/utils/network';

const HomePageLazy = lazy(() => import('@/pages/website/HomePage'));

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

  console.log('Rendering modern marketing homepage on main domain');
  
  return (
    <>
      <NetworkAwareContent
        lowBandwidthFallback={
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-4">Welcome to Soul Symphony</h1>
            <p className="text-center mb-6">
              We've detected you're on a slow connection. 
              We're loading a lightweight version of our site for better performance.
            </p>
            <div className="animate-pulse">Loading optimized content...</div>
          </div>
        }
        offlineFallback={
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-4">You're currently offline</h1>
            <p className="text-center mb-6">
              Please check your connection to access all features.
              Some content may still be available from cache.
            </p>
          </div>
        }
      >
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        }>
          <HomePageLazy />
        </Suspense>
      </NetworkAwareContent>
    </>
  );
};

export default Index;
