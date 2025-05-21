
import React, { useEffect } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import JournalHeader from '@/components/home/JournalHeader';
import JournalNavigationButton from '@/components/home/JournalNavigationButton';
import JournalContent from '@/components/home/JournalContent';
import BackgroundElements from '@/components/home/BackgroundElements';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';

const Home = () => {
  const { isActive, currentStep, steps, navigationState } = useTutorial();
  // Restore scroll position
  useScrollRestoration();
  
  // Check if we're in specific tutorial steps
  const isInWelcomeTutorialStep = isActive && steps[currentStep]?.id === 1;
  const isInArrowTutorialStep = isActive && steps[currentStep]?.id === 2;
  
  useEffect(() => {
    console.log('Home component mounted, tutorial state:', {
      isActive, 
      currentStep, 
      stepId: steps[currentStep]?.id,
      navigationInProgress: navigationState.inProgress
    });
    
    // Prevent scrolling ONLY when tutorial is active
    if (isActive) {
      document.body.style.overflow = 'hidden';
    }
    
    // Cleanup function to restore scrolling
    return () => {
      document.body.style.overflow = '';
    };
  }, [isActive, currentStep, steps, navigationState]);

  return (
    <div 
      className="min-h-screen bg-background text-foreground relative overflow-hidden"
      style={{ 
        // Only apply fixed positioning when tutorial is active
        ...(isActive ? {
          touchAction: 'none',
          overflow: 'hidden',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%'
        } : {})
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
