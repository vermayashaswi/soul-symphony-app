import React, { useEffect } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import JournalHeader from '@/components/home/JournalHeader';
import JournalNavigationButton from '@/components/home/JournalNavigationButton';
import JournalContent from '@/components/home/JournalContent';
import BackgroundElements from '@/components/home/BackgroundElements';
import { PWATestIndicator } from '@/components/home/PWATestIndicator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// WebView detection utility
const isWebView = (): boolean => {
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
};

const Home = () => {
  const { isActive, currentStep, steps, navigationState, startTutorial } = useTutorial();
  const { user } = useAuth();
  
  // Check if we're in specific tutorial steps
  const isInWelcomeTutorialStep = isActive && steps[currentStep]?.id === 1;
  const isInArrowTutorialStep = isActive && steps[currentStep]?.id === 2;
  
  // Add test plan logging
  useEffect(() => {
    console.log('[Home] TEST PLAN: Component mounted with tutorial state:', {
      isActive, 
      currentStep, 
      stepId: steps[currentStep]?.id,
      navigationInProgress: navigationState.inProgress,
      isWebView: isWebView()
    });
  }, []);
  
  // Tutorial startup logic - let TutorialContext handle the main logic
  useEffect(() => {
    const initializeTutorialIfNeeded = async () => {
      if (!user) return;
      
      try {
        console.log('[Home] Checking if tutorial should be started for user:', user.id);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('tutorial_completed, tutorial_step')
          .eq('id', user.id)
          .maybeSingle();
        
        if (error) {
          console.error('[Home] Error checking tutorial status:', error);
          return;
        }
        
        // Only assist with tutorial startup if clearly needed and not already handled
        if (profile && profile.tutorial_completed === 'NO' && !isActive && !navigationState.inProgress) {
          console.log('[Home] Tutorial needed but not active, requesting startup');
          
          // Give TutorialContext a small delay to handle its own logic first
          setTimeout(() => {
            if (!isActive && !navigationState.inProgress) {
              console.log('[Home] Starting tutorial as backup measure');
              startTutorial();
            }
          }, 200);
        } else if (!profile) {
          // New user without profile - set up tutorial
          console.log('[Home] New user detected, setting up tutorial');
          
          const { error: updateError } = await supabase
            .from('profiles')
            .upsert({ 
              id: user.id,
              tutorial_completed: 'NO',
              tutorial_step: 0
            });
            
          if (!updateError) {
            setTimeout(() => {
              console.log('[Home] Starting tutorial for new user');
              startTutorial();
            }, 200);
          }
        } else {
          console.log('[Home] Tutorial status check complete:', {
            tutorialCompleted: profile.tutorial_completed,
            isActive,
            navigationInProgress: navigationState.inProgress
          });
        }
      } catch (err) {
        console.error('[Home] Error in tutorial initialization logic:', err);
      }
    };
    
    // Only run if we haven't already started the tutorial
    if (!isActive && !navigationState.inProgress) {
      initializeTutorialIfNeeded();
    }
  }, [user, startTutorial, isActive, navigationState.inProgress]);
  
  useEffect(() => {
    console.log('[Home] TEST PLAN: Component mounted, tutorial state:', {
      isActive, 
      currentStep, 
      stepId: steps[currentStep]?.id,
      navigationInProgress: navigationState.inProgress,
      isWebView: isWebView()
    });
    
    // Always prevent scrolling on home page - regardless of tutorial state
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.top = '0';
    document.body.style.left = '0';
    
    // Apply WebView-specific body styling
    if (isWebView()) {
      console.log('[Home] TEST PLAN: Applying WebView-specific styling');
      document.body.classList.add('webview-environment');
      
      // Ensure proper background containment for WebView
      document.body.style.backgroundColor = 'var(--background)';
      document.body.style.contain = 'layout style paint';
      document.body.style.isolation = 'isolate';
      
      // Add WebView-specific CSS
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
    
    // Cleanup function to restore scrolling when navigating away
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.classList.remove('webview-environment');
      
      // Remove WebView styles if they exist
      const webViewStyles = document.getElementById('webview-home-styles');
      if (webViewStyles) {
        webViewStyles.remove();
      }
    };
  }, [isActive, currentStep, steps, navigationState]);

  return (
    <div 
      className={`min-h-screen bg-background text-foreground relative overflow-hidden ${isWebView() ? 'home-container' : ''}`}
      style={{ 
        // Always apply fixed positioning on home page (not just during tutorial)
        touchAction: 'none',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        // WebView-specific enhancements
        contain: isWebView() ? 'layout style paint' : 'none',
        isolation: isWebView() ? 'isolate' : 'auto',
        backgroundColor: 'var(--background)'
      }}
    >
      {/* TEST PLAN: PWA Test Indicator - visible on all environments */}
      <PWATestIndicator />

      {/* Background elements including animations */}
      <BackgroundElements />

      {/* Central navigation button - positioned in the center of the screen */}
      <JournalNavigationButton />

      {/* Journal content with summary and quote */}
      <JournalContent />

      {/* Header with journal name and date - ensure visibility during tutorial */}
      <div className={`relative ${isInWelcomeTutorialStep ? 'z-[9999]' : 'z-20'} flex flex-col`}>
        <JournalHeader />
      </div>
    </div>
  );
};

export default Home;
