
import React, { useEffect } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import TutorialOverlay from '@/components/tutorial/TutorialOverlay';
import JournalHeader from '@/components/home/JournalHeader';
import JournalNavigationButton from '@/components/home/JournalNavigationButton';
import JournalContent from '@/components/home/JournalContent';
import BackgroundElements from '@/components/home/BackgroundElements';

const Home = () => {
  const { isActive, currentStep, steps } = useTutorial();
  
  // Check if we're in tutorial step 2
  const isInArrowTutorialStep = isActive && steps[currentStep]?.id === 2;
  
  useEffect(() => {
    console.log('Home component mounted, tutorial active:', isActive);
    console.log('Current tutorial step:', currentStep);
    
    // Enhanced check for tutorial element visibility
    if (isActive) {
      setTimeout(() => {
        const arrowButton = document.querySelector('.journal-arrow-button');
        if (arrowButton) {
          const rect = arrowButton.getBoundingClientRect();
          console.log('Journal arrow button found:', rect);
          console.log('Journal arrow center point:', {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          });
          
          // Check if button is visible and positioned correctly
          if (rect.width === 0 || rect.height === 0) {
            console.warn('Arrow button has zero dimensions!');
          }
          
          // Verify z-index
          const computedStyle = window.getComputedStyle(arrowButton);
          console.log('Arrow button z-index:', computedStyle.zIndex);
        } else {
          console.warn('Journal arrow button not found in DOM');
        }
      }, 500); // Small delay to ensure component is fully rendered
    }
  }, [isActive, currentStep]);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Background elements including animations */}
      <BackgroundElements />

      {/* Central navigation button with enhanced positioning */}
      <div className={`relative ${isInArrowTutorialStep ? 'z-[9998]' : 'z-40'}`}>
        <JournalNavigationButton />
      </div>

      {/* Journal content with summary and quote */}
      <JournalContent />

      {/* Header with journal name and date */}
      <div className="relative z-20 flex flex-col h-screen">
        <JournalHeader />
      </div>

      {/* Tutorial overlay system - this should be last to overlay everything except highlighted elements */}
      <TutorialOverlay />
    </div>
  );
};

export default Home;
