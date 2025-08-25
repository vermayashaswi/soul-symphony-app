
import React, { useEffect } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import JournalHeader from '@/components/home/JournalHeader';
import JournalNavigationButton from '@/components/home/JournalNavigationButton';
import JournalContent from '@/components/home/JournalContent';
import BackgroundElements from '@/components/home/BackgroundElements';
import MusicPlayer from '@/components/music/MusicPlayer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const Home = () => {
  const { isActive, currentStep, steps, navigationState, startTutorial } = useTutorial();
  const { user } = useAuth();
  
  // Check if we're in specific tutorial steps
  const isInWelcomeTutorialStep = isActive && steps[currentStep]?.id === 1;
  const isInArrowTutorialStep = isActive && steps[currentStep]?.id === 2;
  
  // Tutorial startup logic - simplified and more robust
  useEffect(() => {
    const initializeTutorialIfNeeded = async () => {
      if (!user) return;
      
      try {
        console.log('[Home] Checking tutorial status for user:', user.id);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('tutorial_completed, tutorial_step, onboarding_completed')
          .eq('id', user.id)
          .maybeSingle();
        
        if (error) {
          console.error('[Home] Error checking tutorial status:', error);
          return;
        }
        
        console.log('[Home] Profile data:', profile);
        
        // Determine if tutorial should start
        const shouldStartTutorial = profile && 
          profile.tutorial_completed === 'NO' && 
          !isActive && 
          !navigationState.inProgress;
          
        if (shouldStartTutorial) {
          console.log('[Home] Starting tutorial for user with tutorial_completed=NO');
          // Small delay to ensure UI is ready
          setTimeout(() => {
            console.log('[Home] Executing startTutorial()');
            startTutorial();
          }, 100);
        } else {
          console.log('[Home] Tutorial conditions not met:', {
            tutorialCompleted: profile?.tutorial_completed,
            isActive,
            navigationInProgress: navigationState.inProgress,
            hasProfile: !!profile
          });
        }
      } catch (err) {
        console.error('[Home] Error in tutorial initialization:', err);
      }
    };
    
    // Run initialization
    initializeTutorialIfNeeded();
  }, [user, startTutorial, isActive, navigationState.inProgress]);
  
  useEffect(() => {
    console.log('[Home] Component mounted, tutorial state:', {
      isActive, 
      currentStep, 
      stepId: steps[currentStep]?.id,
      navigationInProgress: navigationState.inProgress
    });
    
    // Always prevent scrolling on home page - regardless of tutorial state
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.top = '0';
    document.body.style.left = '0';
    
    // Cleanup function to restore scrolling when navigating away
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
    };
  }, [isActive, currentStep, steps, navigationState]);

  return (
    <div 
      className="min-h-screen min-h-dvh bg-background text-foreground relative overflow-hidden"
      style={{ 
        touchAction: 'none',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%'
      }}
    >
      {/* Background elements including animations */}
      <BackgroundElements />

      {/* Central navigation button - positioned in the center of the screen */}
      <JournalNavigationButton />

      {/* Journal content with summary and quote */}
      <JournalContent />

      {/* Header with journal name and date - ensure visibility during tutorial */}
      <div className={`relative ${isInWelcomeTutorialStep ? 'z-[9999]' : 'z-20'} flex flex-col`}>
        <JournalHeader />
        
        {/* Music Player positioned below header, left-aligned and sticky */}
        <div className="absolute top-full left-4 mt-2">
          <MusicPlayer />
        </div>
      </div>
    </div>
  );
};

export default Home;
