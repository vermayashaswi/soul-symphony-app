
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnboarding } from '@/hooks/use-onboarding';
import NetworkAwareContent from '@/components/NetworkAwareContent';
import { useNetworkStatus } from '@/utils/network';
import HomePage from '@/pages/website/HomePage';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colorTheme } = useTheme();
  const isMobile = useIsMobile();
  const { onboardingComplete, checkOnboardingStatus } = useOnboarding();
  const networkStatus = useNetworkStatus();

  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldRenderMobile = isMobile.isMobile || mobileDemo;

  // Enhanced tutorial status checking for proper navigation flow
  useEffect(() => {
    const handleTutorialNavigation = async () => {
      if (!user) return;
      
      try {
        console.log('[Index] Checking user status for tutorial navigation, user:', user.id);
        
        // First ensure onboarding status is checked
        await checkOnboardingStatus();
        
        // Check if user has completed onboarding
        if (onboardingComplete) {
          console.log('[Index] User completed onboarding, checking tutorial status');
          
          // Check tutorial completion status
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('tutorial_completed, tutorial_step')
            .eq('id', user.id)
            .maybeSingle();
          
          if (error) {
            console.error('[Index] Error checking tutorial status:', error);
            return;
          }
          
          // If tutorial is not completed, let TutorialContext handle the flow
          if (!profileData || profileData.tutorial_completed !== 'YES') {
            console.log('[Index] User has not completed tutorial - TutorialContext will handle startup');
            
            // Ensure tutorial_completed is set to 'NO' for proper detection
            if (!profileData || profileData.tutorial_completed !== 'NO') {
              console.log('[Index] Setting tutorial_completed to NO for proper detection');
              const { error: updateError } = await supabase
                .from('profiles')
                .upsert({ 
                  id: user.id,
                  tutorial_completed: 'NO',
                  tutorial_step: profileData?.tutorial_step || 0
                });
                
              if (updateError) {
                console.error('[Index] Error updating tutorial status:', updateError);
              }
            }
            
            // Don't navigate here - let TutorialContext handle navigation and tutorial startup
            console.log('[Index] Letting TutorialContext handle tutorial startup and navigation');
          } else {
            console.log('[Index] User has completed tutorial, normal app flow');
          }
        } else {
          console.log('[Index] User has not completed onboarding yet');
        }
      } catch (error) {
        console.error('[Index] Error in handleTutorialNavigation:', error);
      }
    };
    
    handleTutorialNavigation();
  }, [user, checkOnboardingStatus, onboardingComplete]);

  // Handle explicit app redirects only
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

  useEffect(() => {
    if (networkStatus.speed === 'slow') {
      console.log('[Index] Slow network detected, optimizing experience...');
    }
  }, [networkStatus.speed]);
  
  console.log('[Index] Rendering Index.tsx component, path:', window.location.pathname, {
    hasUser: !!user,
    onboardingComplete
  });

  // Always render the website homepage component when at root URL
  return (
    <>
      <NetworkAwareContent
        lowBandwidthFallback={
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-4">
              Welcome to Soul Symphony
            </h1>
            <p className="text-center mb-6">
              We've detected you're on a slow connection. We're loading a lightweight version of our site for better performance.
            </p>
            <div className="animate-pulse">
              Loading optimized content...
            </div>
          </div>
        }
        offlineFallback={
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-4">
              You're currently offline
            </h1>
            <p className="text-center mb-6">
              Please check your connection to access all features. Some content may still be available from cache.
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
