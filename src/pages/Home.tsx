
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
    console.log('Current tutorial step:', currentStep, 'Step ID:', steps[currentStep]?.id);
    
    // Prevent scrolling when tutorial is active
    if (isActive) {
      document.body.style.overflow = 'hidden';
      
      // Enhanced check for tutorial element visibility
      if (isInWelcomeTutorialStep) {
        setTimeout(() => {
          const journalHeader = document.querySelector('.journal-header-container');
          if (journalHeader) {
            console.log('Journal header found and ready for tutorial highlighting');
            
            // Log positioning for debugging
            const rect = journalHeader.getBoundingClientRect();
            console.log('Journal header position:', rect);
          } else {
            console.warn('Journal header element not found');
          }
        }, 100);
      } else if (isInArrowTutorialStep) {
        setTimeout(() => {
          const arrowButton = document.querySelector('.journal-arrow-button');
          const buttonElement = document.querySelector('.journal-arrow-button button');
          
          if (arrowButton && buttonElement) {
            console.log('Journal arrow button found and ready for tutorial highlighting');
            
            // Log detailed positioning and z-index for debugging
            const rect = arrowButton.getBoundingClientRect();
            console.log('Arrow button position:', rect);
            console.log('Arrow button center:', {
              x: rect.left + rect.width/2,
              y: rect.top + rect.height/2
            });
            
            // Log z-index for debugging
            const computedStyle = window.getComputedStyle(buttonElement);
            console.log('Arrow button z-index:', computedStyle.zIndex);
            console.log('Arrow button visibility:', computedStyle.visibility);
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
  }, [isActive, currentStep, isInArrowTutorialStep, isInWelcomeTutorialStep, steps]);

  return (
    <div 
      className={`min-h-screen bg-background text-foreground relative overflow-hidden ${isActive ? 'tutorial-active-page' : ''}`}
      style={{ touchAction: isActive ? 'none' : 'auto' }}
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
