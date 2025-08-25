
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
    <div className={`p-4 flex flex-col journal-header-container ${isInWelcomeTutorialStep ? 'tutorial-target' : ''}`}>
      <div className="flex justify-between items-start w-full relative">
        <div className={`relative flex-1 mr-4 ${isInWelcomeTutorialStep ? 'z-[9999]' : ''}`}>
          <h1
            className={`journal-title-responsive font-bold text-theme break-words hyphens-auto ${isInWelcomeTutorialStep ? 'tutorial-highlight' : ''}`}
            style={{
              fontWeight: 700,
              letterSpacing: '0.005em',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              visibility: 'visible',
              opacity: 1
            }}
            title={getJournalName()} // Show full name on hover
          >
            <TranslatableText text={getJournalName()} forceTranslate={true} />
          </h1>
        </div>

        <div className={`flex items-center ${isInWelcomeTutorialStep ? 'z-[9999]' : 'z-50'}`}>
          <motion.div
            variants={dateStripVariants}
            initial="hidden"
            animate="visible"
            className={`px-3 py-1 rounded-l-md whitespace-nowrap ${theme === 'dark' ? 'bg-gray-800/80' : 'bg-gray-100/80'} ${isInWelcomeTutorialStep ? 'tutorial-highlight' : ''}`}
          >
            <div
              className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}
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
          <div className="ml-2 relative z-[1000] pointer-events-auto">
            <LanguageSelector />
          </div>
        </div>
      </div>
    </div>
  );
};

export default JournalHeader;
