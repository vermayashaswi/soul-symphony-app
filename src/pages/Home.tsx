
import React, { useEffect } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import JournalHeader from '@/components/home/JournalHeader';
import JournalNavigationButton from '@/components/home/JournalNavigationButton';
import JournalContent from '@/components/home/JournalContent';
import BackgroundElements from '@/components/home/BackgroundElements';
import { PWABuilderTestIndicator } from '@/components/home/PWABuilderTestIndicator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { nativeAppService } from '@/services/nativeAppService';

const Home = () => {
  const { isActive, currentStep, steps, navigationState, startTutorial } = useTutorial();
  const { user } = useAuth();
  
  const isInWelcomeTutorialStep = isActive && steps[currentStep]?.id === 1;
  const isInArrowTutorialStep = isActive && steps[currentStep]?.id === 2;
  const appInfo = nativeAppService.getAppInfo();
  
  useEffect(() => {
    console.log('[Home] PWA BUILDER: Component mounted', {
      isActive, 
      currentStep, 
      stepId: steps[currentStep]?.id,
      navigationInProgress: navigationState.inProgress,
      isPWABuilder: appInfo.isPWABuilder,
      isNativeApp: appInfo.isNativeApp
    });
  }, []);
  
  // Tutorial startup logic with native app support
  useEffect(() => {
    const initializeTutorialIfNeeded = async () => {
      if (!user) return;
      
      try {
        console.log('[Home] PWA BUILDER: Checking tutorial status for user:', user.id);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('tutorial_completed, tutorial_step')
          .eq('id', user.id)
          .maybeSingle();
        
        if (error) {
          console.error('[Home] PWA BUILDER: Error checking tutorial status:', error);
          return;
        }
        
        if (profile && profile.tutorial_completed === 'NO' && !isActive && !navigationState.inProgress) {
          console.log('[Home] PWA BUILDER: Tutorial needed but not active, requesting startup');
          
          setTimeout(() => {
            if (!isActive && !navigationState.inProgress) {
              console.log('[Home] PWA BUILDER: Starting tutorial as backup measure');
              startTutorial();
            }
          }, 200);
        } else if (!profile) {
          console.log('[Home] PWA BUILDER: New user detected, setting up tutorial');
          
          const { error: updateError } = await supabase
            .from('profiles')
            .upsert({ 
              id: user.id,
              tutorial_completed: 'NO',
              tutorial_step: 0
            });
            
          if (!updateError) {
            setTimeout(() => {
              console.log('[Home] PWA BUILDER: Starting tutorial for new user');
              startTutorial();
            }, 200);
          }
        } else {
          console.log('[Home] PWA BUILDER: Tutorial status check complete:', {
            tutorialCompleted: profile.tutorial_completed,
            isActive,
            navigationInProgress: navigationState.inProgress
          });
        }
      } catch (err) {
        console.error('[Home] PWA BUILDER: Error in tutorial initialization logic:', err);
      }
    };
    
    if (!isActive && !navigationState.inProgress) {
      initializeTutorialIfNeeded();
    }
  }, [user, startTutorial, isActive, navigationState.inProgress]);
  
  useEffect(() => {
    console.log('[Home] PWA BUILDER: Enhanced component effects', {
      isActive, 
      currentStep, 
      stepId: steps[currentStep]?.id,
      navigationInProgress: navigationState.inProgress,
      isPWABuilder: appInfo.isPWABuilder,
      isNativeApp: appInfo.isNativeApp
    });
    
    // Always prevent scrolling on home page
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.top = '0';
    document.body.style.left = '0';
    
    // Enhanced PWA Builder styling with runtime fixes
    if (appInfo.isPWABuilder) {
      console.log('[Home] PWA BUILDER: Applying enhanced PWA Builder styling');
      
      // Apply PWA Builder fixes from service
      nativeAppService.applyPWABuilderFixes();
      
      // Force consistent background color
      const isDark = document.documentElement.classList.contains('dark');
      const backgroundColor = isDark ? '#0a0a0a' : '#ffffff';
      
      document.body.style.backgroundColor = backgroundColor;
      document.documentElement.style.backgroundColor = backgroundColor;
      
      // Ensure proper CSS variables are set
      const root = document.documentElement;
      if (isDark) {
        root.style.setProperty('--background', '240 10% 3.9%');
        root.style.setProperty('--foreground', '0 0% 98%');
      } else {
        root.style.setProperty('--background', '0 0% 100%');
        root.style.setProperty('--foreground', '240 10% 3.9%');
      }
      
      // Apply PWA Builder specific classes
      document.body.classList.add('pwa-builder-app', 'native-app-environment');
      
    } else if (appInfo.isNativeApp) {
      console.log('[Home] PWA BUILDER: Applying enhanced native app styling');
      document.body.classList.add('webview-environment', 'native-app-environment');
      
      document.body.style.backgroundColor = 'var(--background)';
      document.body.style.contain = 'layout style paint';
      document.body.style.isolation = 'isolate';
      
    } else {
      const isWebView = (() => {
        try {
          const userAgent = navigator.userAgent;
          return userAgent.includes('wv') || 
                 userAgent.includes('WebView') || 
                 window.location.protocol === 'file:' ||
                 (window as any).AndroidInterface !== undefined ||
                 document.URL.indexOf('http://') === -1 && document.URL.indexOf('https://') === -1;
        } catch {
          return false;
        }
      })();

      if (isWebView) {
        console.log('[Home] PWA BUILDER: Applying WebView-specific styling');
        document.body.classList.add('webview-environment');
        
        document.body.style.backgroundColor = 'var(--background)';
        document.body.style.contain = 'layout style paint';
        document.body.style.isolation = 'isolate';
      }
    }
    
    // Cleanup function
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.classList.remove('webview-environment', 'native-app-environment', 'pwa-builder-app');
    };
  }, [isActive, currentStep, steps, navigationState, appInfo]);

  return (
    <div 
      className={`min-h-screen bg-background text-foreground relative overflow-hidden ${
        appInfo.isPWABuilder ? 'home-container pwa-builder-container' : 
        appInfo.isNativeApp ? 'home-container native-app-container' : 
        'home-container'
      }`}
      style={{ 
        touchAction: 'none',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        contain: appInfo.isNativeApp ? 'layout style paint' : 'none',
        isolation: appInfo.isNativeApp ? 'isolate' : 'auto',
        backgroundColor: appInfo.isPWABuilder ? 
          (document.documentElement.classList.contains('dark') ? '#0a0a0a' : '#ffffff') : 
          'var(--background)',
        willChange: appInfo.isNativeApp ? 'transform' : 'auto'
      }}
    >
      {/* Show PWA Builder test indicator only for PWA Builder apps */}
      {appInfo.isPWABuilder && <PWABuilderTestIndicator />}

      <BackgroundElements />

      <JournalNavigationButton />

      <JournalContent />

      <div className={`relative ${isInWelcomeTutorialStep ? 'z-[9999]' : 'z-20'} flex flex-col`}>
        <JournalHeader />
      </div>
    </div>
  );
};

export default Home;
