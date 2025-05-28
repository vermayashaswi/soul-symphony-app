
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useTheme } from '@/hooks/use-theme';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import LanguageSelector from '@/components/LanguageSelector';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/contexts/AuthContext';

// Optional tutorial hook with error handling
const useTutorialSafe = () => {
  try {
    const { useTutorial } = require('@/contexts/TutorialContext');
    return useTutorial();
  } catch (error) {
    console.warn('Tutorial context not available:', error);
    return {
      isActive: false,
      currentStep: 0,
      steps: [],
      isInStep: () => false
    };
  }
};

const JournalHeader: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { displayName } = useUserProfile();
  const { translate } = useTranslation();
  const [journalLabel, setJournalLabel] = useState("Journal");
  const [yourJournalLabel, setYourJournalLabel] = useState("Your Journal");
  const today = new Date();
  const formattedDate = format(today, 'EEE, MMM d');
  
  // Get tutorial context safely
  const tutorialData = useTutorialSafe();
  const isInWelcomeTutorialStep = tutorialData?.isActive && tutorialData?.steps?.[tutorialData?.currentStep]?.id === 1;

  console.log('JournalHeader: Rendering with tutorial state:', {
    isActive: tutorialData?.isActive,
    currentStep: tutorialData?.currentStep,
    isInWelcomeTutorialStep,
    hasUser: !!user
  });

  // Pre-translate common labels
  useEffect(() => {
    const loadTranslations = async () => {
      if (translate) {
        try {
          setJournalLabel(await translate("Journal", "en"));
          setYourJournalLabel(await translate("Your Journal", "en"));
        } catch (error) {
          console.warn('Translation failed, using fallback:', error);
        }
      }
    };
    
    loadTranslations();
  }, [translate]);

  // Listen for language changes
  useEffect(() => {
    const handleLanguageChange = async () => {
      if (translate) {
        try {
          setJournalLabel(await translate("Journal", "en"));
          setYourJournalLabel(await translate("Your Journal", "en"));
        } catch (error) {
          console.warn('Translation failed on language change, using fallback:', error);
        }
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
    visible: { x: 0, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <div className={`p-4 flex flex-col journal-header-container ${isInWelcomeTutorialStep ? 'tutorial-target' : ''}`}>
      <div className="flex justify-between items-start w-full relative">
        <div className={`relative max-w-[65%] ${isInWelcomeTutorialStep ? 'z-[9999]' : ''}`}>
          <h1
            className={`text-2xl font-bold text-theme break-words hyphens-auto ${isInWelcomeTutorialStep ? 'tutorial-highlight' : ''}`}
            style={{
              fontWeight: 700,
              letterSpacing: '0.005em',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              display: isInWelcomeTutorialStep ? 'block' : '-webkit-box',
              WebkitLineClamp: isInWelcomeTutorialStep ? 'none' : '2',
              WebkitBoxOrient: 'vertical',
              overflow: isInWelcomeTutorialStep ? 'visible' : 'hidden',
              maxHeight: isInWelcomeTutorialStep ? 'none' : '60px',
              visibility: 'visible',
              opacity: 1
            }}
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
