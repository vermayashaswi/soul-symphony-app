
import React, { useEffect } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import JournalHeader from '@/components/home/JournalHeader';
import JournalNavigationButton from '@/components/home/JournalNavigationButton';
import JournalContent from '@/components/home/JournalContent';
import BackgroundElements from '@/components/home/BackgroundElements';
import { PWATestIndicator } from '@/components/home/PWATestIndicator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { nativeAppService } from '@/services/nativeAppService';

const Home = () => {
  const { isActive, currentStep, steps, navigationState, startTutorial } = useTutorial();
  const { user } = useAuth();
  
  const isInWelcomeTutorialStep = isActive && steps[currentStep]?.id === 1;
  const isInArrowTutorialStep = isActive && steps[currentStep]?.id === 2;
  const isNativeApp = nativeAppService.isNativeApp();
  
  useEffect(() => {
    console.log('[Home] NATIVE FIX: Component mounted with enhanced native app support', {
      isActive, 
      currentStep, 
      stepId: steps[currentStep]?.id,
      navigationInProgress: navigationState.inProgress,
      isNativeApp
    });
  }, []);
  
  // Tutorial startup logic with native app support
  useEffect(() => {
    const initializeTutorialIfNeeded = async () => {
      if (!user) return;
      
      try {
        console.log('[Home] NATIVE FIX: Checking tutorial status for user:', user.id);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('tutorial_completed, tutorial_step')
          .eq('id', user.id)
          .maybeSingle();
        
        if (error) {
          console.error('[Home] NATIVE FIX: Error checking tutorial status:', error);
          return;
        }
        
        if (profile && profile.tutorial_completed === 'NO' && !isActive && !navigationState.inProgress) {
          console.log('[Home] NATIVE FIX: Tutorial needed but not active, requesting startup');
          
          setTimeout(() => {
            if (!isActive && !navigationState.inProgress) {
              console.log('[Home] NATIVE FIX: Starting tutorial as backup measure');
              startTutorial();
            }
          }, 200);
        } else if (!profile) {
          console.log('[Home] NATIVE FIX: New user detected, setting up tutorial');
          
          const { error: updateError } = await supabase
            .from('profiles')
            .upsert({ 
              id: user.id,
              tutorial_completed: 'NO',
              tutorial_step: 0
            });
            
          if (!updateError) {
            setTimeout(() => {
              console.log('[Home] NATIVE FIX: Starting tutorial for new user');
              startTutorial();
            }, 200);
          }
        } else {
          console.log('[Home] NATIVE FIX: Tutorial status check complete:', {
            tutorialCompleted: profile.tutorial_completed,
            isActive,
            navigationInProgress: navigationState.inProgress
          });
        }
      } catch (err) {
        console.error('[Home] NATIVE FIX: Error in tutorial initialization logic:', err);
      }
    };
    
    if (!isActive && !navigationState.inProgress) {
      initializeTutorialIfNeeded();
    }
  }, [user, startTutorial, isActive, navigationState.inProgress]);
  
  useEffect(() => {
    console.log('[Home] NATIVE FIX: Enhanced component effects', {
      isActive, 
      currentStep, 
      stepId: steps[currentStep]?.id,
      navigationInProgress: navigationState.inProgress,
      isNativeApp
    });
    
    // Always prevent scrolling on home page
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.top = '0';
    document.body.style.left = '0';
    
    // Enhanced native app styling
    if (isNativeApp) {
      console.log('[Home] NATIVE FIX: Applying enhanced native app styling');
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
      // Apply WebView-specific styling for regular WebView
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
        console.log('[Home] NATIVE FIX: Applying WebView-specific styling');
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
      document.body.classList.remove('webview-environment', 'native-app-environment');
      
      const nativeStyles = document.getElementById('native-home-styles');
      if (nativeStyles) {
        nativeStyles.remove();
      }
      
      const webViewStyles = document.getElementById('webview-home-styles');
      if (webViewStyles) {
        webViewStyles.remove();
      }
    };
  }, [isActive, currentStep, steps, navigationState, isNativeApp]);

  return (
    <div 
      className={`min-h-screen bg-background text-foreground relative overflow-hidden ${isNativeApp ? 'home-container native-app-container' : 'home-container'}`}
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
        contain: isNativeApp ? 'layout style paint' : 'none',
        isolation: isNativeApp ? 'isolate' : 'auto',
        backgroundColor: 'var(--background)',
        willChange: isNativeApp ? 'transform' : 'auto'
      }}
    >
      <PWATestIndicator />

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
