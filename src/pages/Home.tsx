
import React, { useEffect } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import JournalHeader from '@/components/home/JournalHeader';
import JournalNavigationButton from '@/components/home/JournalNavigationButton';
import JournalContent from '@/components/home/JournalContent';
import BackgroundElements from '@/components/home/BackgroundElements';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const Home = () => {
  const { isActive, currentStep, steps, navigationState, startTutorial } = useTutorial();
  const { user } = useAuth();
  
  // Check if we're in specific tutorial steps
  const isInWelcomeTutorialStep = isActive && steps[currentStep]?.id === 1;
  const isInArrowTutorialStep = isActive && steps[currentStep]?.id === 2;
  
  // SIMPLIFIED tutorial startup logic - more deterministic for new users
  useEffect(() => {
    const initializeTutorialIfNeeded = async () => {
      if (!user) {
        console.log('[Home] No user found, skipping tutorial initialization');
        return;
      }
      
      // Don't interfere if tutorial is already active or navigation is in progress
      if (isActive || navigationState.inProgress) {
        console.log('[Home] Tutorial already active or navigation in progress, skipping');
        return;
      }
      
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
        
        // SIMPLIFIED LOGIC: Start tutorial if NOT completed, regardless of profile existence
        const shouldStartTutorial = !profile || profile.tutorial_completed === 'NO';
        
        if (shouldStartTutorial) {
          console.log('[Home] Starting tutorial immediately for user');
          
          // Ensure profile exists with correct tutorial status
          if (!profile) {
            await supabase
              .from('profiles')
              .upsert({ 
                id: user.id,
                tutorial_completed: 'NO',
                tutorial_step: 0,
                onboarding_completed: false
              });
          }
          
          // Start tutorial immediately - no delays
          startTutorial();
        } else {
          console.log('[Home] Tutorial already completed, skipping');
        }
      } catch (err) {
        console.error('[Home] Error in tutorial initialization:', err);
      }
    };
    
    // Run immediately when user is available and tutorial is not active
    if (user && !isActive && !navigationState.inProgress) {
      initializeTutorialIfNeeded();
    }
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
      className="min-h-screen bg-background text-foreground relative overflow-hidden"
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
      </div>
    </div>
  );
};

export default Home;
