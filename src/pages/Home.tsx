
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
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* Background elements including animations */}
      <BackgroundElements />

      {/* Journal content with summary and quote */}
      <JournalContent />

      {/* Central navigation button - moved up in the DOM order to ensure proper z-index */}
      <JournalNavigationButton />

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
