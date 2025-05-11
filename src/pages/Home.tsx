
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

      {/* Tutorial overlay system */}
      <TutorialOverlay />

      <div className="relative z-20 flex flex-col h-screen">
        {/* Header with journal name and date */}
        <JournalHeader />
      </div>

      {/* Central navigation button */}
      <JournalNavigationButton />

      {/* Journal content with summary and quote */}
      <JournalContent />
    </div>
  );
};

export default Home;
