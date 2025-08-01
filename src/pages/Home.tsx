
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
  
  // Enhanced tutorial startup logic - more robust for new users
  useEffect(() => {
    const initializeTutorialIfNeeded = async () => {
      if (!user) {
        console.log('[Home] No user found, skipping tutorial initialization');
        return;
      }
      
      try {
        console.log('[Home] Checking tutorial status for user:', {
          userId: user.id,
          currentIsActive: isActive,
          navigationInProgress: navigationState.inProgress
        });
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('tutorial_completed, tutorial_step, onboarding_completed')
          .eq('id', user.id)
          .maybeSingle();
        
        if (error) {
          console.error('[Home] Error checking tutorial status:', error);
          return;
        }
        
        console.log('[Home] Profile data retrieved:', {
          profile,
          hasProfile: !!profile,
          tutorialCompleted: profile?.tutorial_completed,
          onboardingCompleted: profile?.onboarding_completed
        });
        
        // Case 1: User has profile but tutorial not completed
        if (profile && profile.tutorial_completed === 'NO' && !isActive && !navigationState.inProgress) {
          console.log('[Home] Tutorial needed for existing user - starting tutorial');
          
          // Give TutorialContext a moment to handle its own logic first
          setTimeout(() => {
            if (!isActive && !navigationState.inProgress) {
              console.log('[Home] Starting tutorial as backup for existing user');
              startTutorial();
            }
          }, 300);
        } 
        // Case 2: New user without profile - set up tutorial regardless of onboarding status
        else if (!profile) {
          console.log('[Home] New user detected - creating profile and starting tutorial');
          
          const { error: updateError } = await supabase
            .from('profiles')
            .upsert({ 
              id: user.id,
              tutorial_completed: 'NO',
              tutorial_step: 0,
              onboarding_completed: false // Ensure onboarding tracking
            });
            
          if (!updateError) {
            setTimeout(() => {
              console.log('[Home] Starting tutorial for new user');
              startTutorial();
            }, 300);
          } else {
            console.error('[Home] Error creating profile for new user:', updateError);
          }
        } 
        // Case 3: Tutorial already completed or active
        else {
          console.log('[Home] Tutorial check complete - no action needed:', {
            tutorialCompleted: profile.tutorial_completed,
            isActive,
            navigationInProgress: navigationState.inProgress,
            onboardingCompleted: profile.onboarding_completed
          });
        }
      } catch (err) {
        console.error('[Home] Error in tutorial initialization logic:', err);
      }
    };
    
    // Only run if we haven't already started the tutorial and have a user
    if (!isActive && !navigationState.inProgress && user) {
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
