import React, { useEffect } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import JournalHeader from '@/components/home/JournalHeader';
import JournalNavigationButton from '@/components/home/JournalNavigationButton';
import JournalContent from '@/components/home/JournalContent';
import BackgroundElements from '@/components/home/BackgroundElements';
import { PWATestIndicator } from '@/components/home/PWATestIndicator';
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
    
    // Enhanced PWA Builder styling
    if (appInfo.isPWABuilder) {
      console.log('[Home] PWA BUILDER: Applying PWA Builder specific styling');
      document.body.classList.add('pwa-builder-app', 'native-app-environment');
      
      document.body.style.backgroundColor = 'var(--background)';
      document.body.style.contain = 'layout style paint';
      document.body.style.isolation = 'isolate';
      
      const pwaBuilderStyles = document.getElementById('pwa-builder-home-styles') || document.createElement('style');
      pwaBuilderStyles.id = 'pwa-builder-home-styles';
      pwaBuilderStyles.textContent = `
        .pwa-builder-app .home-container {
          -webkit-user-select: none !important;
          -webkit-touch-callout: none !important;
          -webkit-tap-highlight-color: transparent !important;
          contain: layout style paint !important;
          isolation: isolate !important;
          overflow: hidden !important;
          will-change: transform !important;
        }
        
        .pwa-builder-app .journal-arrow-button {
          -webkit-transform: translate3d(0, 0, 0) !important;
          transform: translate3d(0, 0, 0) !important;
          contain: layout style !important;
          will-change: transform !important;
        }
        
        .pwa-builder-app .pwa-builder-test-indicator {
          z-index: 10000 !important;
          position: fixed !important;
          top: 4px !important;
          right: 4px !important;
        }
        
        .pwa-builder-cache-clear-${Date.now()} {
          background: linear-gradient(45deg, transparent 0%, transparent 100%);
        }
      `;
      
      if (!document.getElementById('pwa-builder-home-styles')) {
        document.head.appendChild(pwaBuilderStyles);
      }
    } else if (appInfo.isNativeApp) {
      console.log('[Home] PWA BUILDER: Applying enhanced native app styling');
      document.body.classList.add('webview-environment', 'native-app-environment');
      
      document.body.style.backgroundColor = 'var(--background)';
      document.body.style.contain = 'layout style paint';
      document.body.style.isolation = 'isolate';
      
      const nativeHomeStyles = document.getElementById('native-home-styles') || document.createElement('style');
      nativeHomeStyles.id = 'native-home-styles';
      nativeHomeStyles.textContent = `
        .native-app-environment .home-container {
          -webkit-user-select: none !important;
          -webkit-touch-callout: none !important;
          -webkit-tap-highlight-color: transparent !important;
          contain: layout style paint !important;
          isolation: isolate !important;
          overflow: hidden !important;
          will-change: transform !important;
        }
        
        .native-app-environment .journal-arrow-button {
          -webkit-transform: translate3d(0, 0, 0) !important;
          transform: translate3d(0, 0, 0) !important;
          contain: layout style !important;
          will-change: transform !important;
        }
        
        .native-app-environment .pwa-test-indicator {
          z-index: 10000 !important;
          position: fixed !important;
          top: 4px !important;
          right: 4px !important;
        }
        
        .native-cache-clear-${Date.now()} {
          background: linear-gradient(45deg, transparent 0%, transparent 100%);
        }
      `;
      
      if (!document.getElementById('native-home-styles')) {
        document.head.appendChild(nativeHomeStyles);
      }
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
        
        const webViewStyles = document.getElementById('webview-home-styles') || document.createElement('style');
        webViewStyles.id = 'webview-home-styles';
        webViewStyles.textContent = `
          .webview-environment .home-container {
            -webkit-user-select: none !important;
            -webkit-touch-callout: none !important;
            -webkit-tap-highlight-color: transparent !important;
            contain: layout style paint !important;
            isolation: isolate !important;
            overflow: hidden !important;
          }
          
          .webview-environment .journal-arrow-button {
            -webkit-transform: translate3d(0, 0, 0) !important;
            transform: translate3d(0, 0, 0) !important;
            contain: layout style !important;
          }
        `;
        
        if (!document.getElementById('webview-home-styles')) {
          document.head.appendChild(webViewStyles);
        }
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
      
      const pwaBuilderStyles = document.getElementById('pwa-builder-home-styles');
      if (pwaBuilderStyles) {
        pwaBuilderStyles.remove();
      }
      
      const nativeStyles = document.getElementById('native-home-styles');
      if (nativeStyles) {
        nativeStyles.remove();
      }
      
      const webViewStyles = document.getElementById('webview-home-styles');
      if (webViewStyles) {
        webViewStyles.remove();
      }
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
        backgroundColor: 'var(--background)',
        willChange: appInfo.isNativeApp ? 'transform' : 'auto'
      }}
    >
      {/* Show appropriate test indicator based on app type */}
      {appInfo.isPWABuilder ? <PWABuilderTestIndicator /> : <PWATestIndicator />}

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
