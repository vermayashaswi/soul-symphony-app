
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useTheme } from '@/hooks/use-theme';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import LanguageSelector from '@/components/LanguageSelector';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useTutorial } from '@/contexts/TutorialContext';
import MusicIconButton from '@/components/music/MusicIconButton';
import HomeNotificationBell from '@/components/home/HomeNotificationBell';

const JournalHeader: React.FC = () => {
  const { user } = useAuth();
  // Defensive hook usage to prevent runtime errors during app initialization
  let theme = 'light';
  
  try {
    const themeData = useTheme();
    theme = themeData.theme;
  } catch (error) {
    console.warn('JournalHeader: ThemeProvider not ready, using defaults');
  }
  const { displayName } = useUserProfile();
  const { translate } = useTranslation();
  const [journalLabel, setJournalLabel] = useState("Journal");
  const [yourJournalLabel, setYourJournalLabel] = useState("Your Journal");
  const today = new Date();
  const formattedDate = format(today, 'EEE, MMM d');
  
  // Get tutorial context to check if we're in step 1
  const { isActive, currentStep, steps } = useTutorial();
  const isInWelcomeTutorialStep = isActive && steps[currentStep]?.id === 1;

  // Pre-translate common labels
  useEffect(() => {
    const loadTranslations = async () => {
      if (translate) {
        setJournalLabel(await translate("Journal", "en"));
        setYourJournalLabel(await translate("Your Journal", "en"));
      }
    };
    
    loadTranslations();
  }, [translate]);

  // Listen for language changes
  useEffect(() => {
    const handleLanguageChange = async () => {
      if (translate) {
        setJournalLabel(await translate("Journal", "en"));
        setYourJournalLabel(await translate("Your Journal", "en"));
      }
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [translate]);

  const getJournalName = () => {
    if (displayName) {
      return displayName.endsWith('s') ? 
        `${displayName}' ${journalLabel}` : 
        `${displayName}'s ${journalLabel}`;
    }
    if (user?.email) {
      const name = user.email.split('@')[0];
      return name.endsWith('s') ? 
        `${name}' ${journalLabel}` : 
        `${name}'s ${journalLabel}`;
    }
    return yourJournalLabel;
  };

  const dateStripVariants = {
    hidden: { x: 100, opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const } }
  };

  return (
    <div className={`p-4 journal-header-container relative ${isInWelcomeTutorialStep ? 'tutorial-target' : ''}`}>
      {/* Journal title - allow wrapping with fixed right margin for absolutely positioned elements */}
      <div className={`relative pr-32 ${isInWelcomeTutorialStep ? 'z-[9999]' : ''}`}>
        <h1
          className={`journal-title-responsive font-black text-theme break-words hyphens-auto ${isInWelcomeTutorialStep ? 'tutorial-highlight' : ''}`}
          style={{
            fontSize: '125%', // 25% increase from base size
            fontWeight: 900, // Extra bold
            letterSpacing: '0.005em',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            visibility: 'visible',
            opacity: 1,
            wordBreak: 'break-word',
            lineHeight: 1.2
          }}
          title={getJournalName()} // Show full name on hover
        >
          <TranslatableText text={getJournalName()} forceTranslate={true} />
        </h1>
      </div>

      {/* FIXED POSITION: Date strip - emerges from right edge, starts from globe icon */}
      <motion.div
        variants={dateStripVariants}
        initial="hidden"
        animate="visible"
        className={`absolute top-4 right-0 pl-3 pr-3 py-1 rounded-l-md whitespace-nowrap ${theme === 'dark' ? 'bg-gray-800/80' : 'bg-gray-100/80'} ${isInWelcomeTutorialStep ? 'tutorial-highlight z-[9999]' : 'z-50'}`}
        style={{ left: 'calc(100% - 120px)' }}
      >
        <div
          className={`text-sm font-medium text-left ${theme === 'dark' ? 'text-white' : 'text-black'}`}
          style={{
            fontWeight: 500,
            letterSpacing: '0.01em',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            visibility: 'visible',
            opacity: 1
          }}
        >
          <TranslatableText text={formattedDate} forceTranslate={true} />
        </div>
      </motion.div>
      
      {/* Right side icons - positioned absolutely with perfect alignment */}
      <div className="absolute top-12 right-4 flex items-center gap-2">
        {/* Language selector */}
        <div className={`h-8 w-8 flex items-center justify-center ${isInWelcomeTutorialStep ? 'z-[9999]' : 'z-[1000]'}`}>
          <LanguageSelector />
        </div>
        
        {/* Notification bell */}
        <div className={`h-8 w-8 flex items-center justify-center ${isInWelcomeTutorialStep ? 'z-[9999]' : 'z-[1000]'}`}>
          <HomeNotificationBell />
        </div>
        
        {/* Music icon button */}
        <div className={`h-8 w-8 flex items-center justify-center ${isInWelcomeTutorialStep ? 'z-[9999]' : 'z-[1000]'}`}>
          <MusicIconButton />
        </div>
      </div>
    </div>
  );
};

export default JournalHeader;
