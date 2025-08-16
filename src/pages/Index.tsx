import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnboarding } from '@/hooks/use-onboarding';
import NetworkAwareContent from '@/components/NetworkAwareContent';
import { useNetworkStatus } from '@/utils/network';
import HomePage from '@/pages/website/HomePage';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { supabase } from '@/integrations/supabase/client';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { onboardingComplete, checkOnboardingStatus } = useOnboarding();
  const networkStatus = useNetworkStatus();
  const { translate } = useTranslation();

  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldRenderMobile = isMobile.isMobile || mobileDemo;
  const isNative = nativeIntegrationService.isRunningNatively();

  // CRITICAL: For native apps, redirect immediately - never show marketing site
  useEffect(() => {
    if (isNative) {
      console.log('[Index] Native app detected, redirecting to app interface');
      
      // Check for OAuth callback parameters first
      const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
      const hasOAuthParams = urlParams.has('access_token') || hashParams.has('access_token') ||
                            urlParams.has('code') || hashParams.has('code') ||
                            urlParams.has('error') || hashParams.has('error');

      if (hasOAuthParams) {
        console.log('[Index] OAuth callback detected in native app, redirecting to auth');
        navigate(`/app/auth${window.location.search}${window.location.hash}`, { replace: true });
        return;
      }

      // Redirect based on user status with improved onboarding check
      if (!user) {
        console.log('[Index] No user in native app, redirecting to onboarding');
        navigate('/app/onboarding', { replace: true });
      } else {
        // Check both localStorage and database for onboarding status
        checkOnboardingStatus().then((isComplete) => {
          if (!isComplete) {
            console.log('[Index] Onboarding not complete in native app, redirecting to onboarding');
            navigate('/app/onboarding', { replace: true });
          } else {
            console.log('[Index] Native app user ready, redirecting to home');
            navigate('/app/home', { replace: true });
          }
        }).catch(() => {
          // Fallback to onboarding if check fails
          navigate('/app/onboarding', { replace: true });
        });
      }
      return;
    }
  }, [isNative, user, navigate, urlParams, checkOnboardingStatus]);

  // Enhanced tutorial status checking for proper navigation flow - ONLY for web users
  useEffect(() => {
    if (isNative) return; // Skip for native apps

    const handleTutorialNavigation = async () => {
      if (!user) return;
      
      try {
        console.log('[Index] Checking user status for tutorial navigation, user:', user.id);
        
        // Use the auth synchronizer for reliable status checking
        const { authStateSynchronizer } = await import('@/services/authStateSynchronizer');
        
        // Ensure profile exists
        await authStateSynchronizer.ensureProfileExists(user.id, user.email);
        
        // Get authoritative onboarding status
        const isOnboardingComplete = await authStateSynchronizer.syncOnboardingStatus(user.id, {
          forceSync: true
        });
        
        console.log('[Index] Onboarding status checked:', { isOnboardingComplete });
        
        // Check if user has completed onboarding
        if (isOnboardingComplete) {
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
  }, [user, isNative]);

  // Handle explicit app redirects only - ONLY for web users
  useEffect(() => {
    if (isNative) return; // Skip for native apps

    // Only redirect to app if explicitly requested with a URL parameter
    if (urlParams.has('app')) {
      console.log('[Index] User explicitly requested app with ?app parameter');
      
      if (user) {
        console.log('[Index] User is logged in, redirecting to appropriate app page');
        checkOnboardingStatus().then((isComplete) => {
          if (isComplete) {
            navigate('/app/home');
          } else {
            navigate('/app/onboarding');
          }
        });
      } else {
        navigate('/app/auth');
      }
    }
    
    // Check URL parameters for specific app features redirects
    if (urlParams.has('insights')) {
      navigate('/app/insights');
    }
  }, [user, navigate, urlParams, checkOnboardingStatus, isNative]);

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
  
  console.log('[Index] Rendering Index.tsx component, path:', window.location.pathname, {
    hasUser: !!user,
    onboardingComplete,
    isNative
  });

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
