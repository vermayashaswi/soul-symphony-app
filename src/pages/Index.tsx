
import React, { useEffect, useState } from 'react';
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
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colorTheme } = useTheme();
  const isMobile = useIsMobile();
  const { onboardingComplete, checkOnboardingStatus } = useOnboarding();
  const networkStatus = useNetworkStatus();
  const { translate } = useTranslation();
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasError, setHasError] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldRenderMobile = isMobile.isMobile || mobileDemo;

  // Initialize the index page
  useEffect(() => {
    const initializeIndex = async () => {
      try {
        console.log('[Index] Initializing index page');
        
        // Pre-translate common strings used on the index page
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
        
        if (networkStatus.speed === 'slow') {
          console.log('[Index] Slow network detected, optimizing experience...');
        }
        
        setIsInitialized(true);
        console.log('[Index] Index page initialization completed');
        
      } catch (error) {
        console.error('[Index] Error initializing index page:', error);
        setHasError(true);
        setIsInitialized(true);
      }
    };

    initializeIndex();
  }, [networkStatus.speed, translate]);

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
    
    if (isInitialized) {
      handleTutorialNavigation();
    }
  }, [user, checkOnboardingStatus, onboardingComplete, isInitialized]);

  // Handle explicit app redirects only
  useEffect(() => {
    if (!isInitialized) return;
    
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
  }, [user, navigate, urlParams, onboardingComplete, isInitialized]);
  
  console.log('[Index] Rendering Index.tsx component, path:', window.location.pathname, {
    hasUser: !!user,
    onboardingComplete,
    isInitialized,
    hasError
  });

  // Show loading state during initialization
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  // Show error state if initialization failed
  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold mb-4">Loading Error</h1>
          <p className="text-muted-foreground mb-6">
            We're having trouble loading the page. Please try refreshing.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

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
