
import React, { useEffect } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import JournalHeader from '@/components/home/JournalHeader';
import JournalNavigationButton from '@/components/home/JournalNavigationButton';
import JournalContent from '@/components/home/JournalContent';
import BackgroundElements from '@/components/home/BackgroundElements';

const Home = () => {
  const { isActive, currentStep, steps } = useTutorial();
  
  // Check if we're in tutorial steps
  const isInArrowTutorialStep = isActive && steps[currentStep]?.id === 2;
  const isInWelcomeTutorialStep = isActive && steps[currentStep]?.id === 1;
  
  useEffect(() => {
    console.log('Home component mounted, tutorial active:', isActive);
    console.log('Current tutorial step:', currentStep);
    
    // Prevent scrolling when tutorial is active
    if (isActive) {
      document.body.style.overflow = 'hidden';
      
      // Enhanced check for tutorial element visibility
      if (isInWelcomeTutorialStep) {
        setTimeout(() => {
          const journalHeader = document.querySelector('.journal-header-container');
          if (journalHeader) {
            console.log('Journal header found and ready for tutorial highlighting');
          }
        }, 100);
      } else if (isInArrowTutorialStep) {
        setTimeout(() => {
          const arrowButton = document.querySelector('.journal-arrow-button');
          const buttonElement = document.querySelector('.journal-arrow-button button');
          
          if (arrowButton && buttonElement) {
            console.log('Journal arrow button found and ready for tutorial highlighting');
            
            // Log z-index for debugging
            const computedStyle = window.getComputedStyle(buttonElement);
            console.log('Arrow button z-index:', computedStyle.zIndex);
          } else {
            console.warn('Journal arrow button not found in DOM');
          }
        }, 100);
      }
      
      // Cleanup function to restore scrolling
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isActive, currentStep, isInArrowTutorialStep, isInWelcomeTutorialStep]);

  return (
    <div 
      className={`min-h-screen bg-background text-foreground relative overflow-hidden ${isActive ? 'tutorial-active-page' : ''}`}
      style={{ touchAction: isActive ? 'none' : 'auto' }}
    >
      {/* Background elements including animations */}
      <BackgroundElements />

      {/* Central navigation button with exact center positioning and maximum z-index */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`pointer-events-auto ${isInArrowTutorialStep ? 'z-[9999]' : 'z-40'}`}>
          <JournalNavigationButton />
        </div>
      </div>

      {/* Journal content with summary and quote */}
      <JournalContent />

      {/* Header with journal name and date - ensure visibility during tutorial */}
      <div className={`relative ${isInWelcomeTutorialStep ? 'z-[9999]' : 'z-20'} flex flex-col`}>
        <JournalHeader />
      </div>

      {/* Removed TutorialOverlay from here as it's now in App.tsx */}
    </div>
  );
};

export default Home;
