
import React, { useEffect } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import TutorialOverlay from '@/components/tutorial/TutorialOverlay';
import JournalHeader from '@/components/home/JournalHeader';
import JournalNavigationButton from '@/components/home/JournalNavigationButton';
import JournalContent from '@/components/home/JournalContent';
import BackgroundElements from '@/components/home/BackgroundElements';

const Home = () => {
  const { isActive } = useTutorial();
  
  useEffect(() => {
    console.log('Home component mounted');
    
    // Check for tutorial element visibility
    if (isActive) {
      const arrowButton = document.querySelector('.journal-arrow-button');
      if (arrowButton) {
        console.log('Journal arrow button found:', arrowButton.getBoundingClientRect());
      } else {
        console.warn('Journal arrow button not found in DOM');
      }
    }
  }, [isActive]);

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* Background elements including animations */}
      <BackgroundElements />

      {/* Central navigation button - ensure it's always properly positioned */}
      <div className="relative z-40">
        <JournalNavigationButton />
      </div>

      {/* Journal content with summary and quote */}
      <JournalContent />

      {/* Header with journal name and date */}
      <div className="relative z-20 flex flex-col h-screen">
        <JournalHeader />
      </div>

      {/* Tutorial overlay system - this should be last to overlay everything */}
      <TutorialOverlay />
    </div>
  );
};

export default Home;
