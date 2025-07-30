
import React from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { useLocation } from 'react-router-dom';
import { useHomeTranslation } from './HomeTranslationProvider';
import { useJournalTranslation } from './JournalTranslationProvider';
import { useChatTranslation } from './ChatTranslationProvider';
import { useSettingsTranslation } from './SettingsTranslationProvider';
import { useInsightsTranslation } from '../insights/InsightsTranslationProvider';

export function TranslationLoadingOverlay() {
  const location = useLocation();
  const { currentLanguage } = useTranslation();
  
  // Don't show for English
  if (currentLanguage === 'en') {
    return null;
  }

  // Safe access to page-specific translation context with default values
  let isTranslating = false;
  let translationProgress = 0;
  
  try {
    const pathname = location.pathname;
    
    if (pathname.includes('/home')) {
      const homeTranslation = useHomeTranslation();
      isTranslating = homeTranslation?.isTranslating || false;
      translationProgress = homeTranslation?.progress || 0;
    } else if (pathname.includes('/journal')) {
      const journalTranslation = useJournalTranslation();
      isTranslating = journalTranslation?.isTranslating || false;
      translationProgress = journalTranslation?.progress || 0;
    } else if (pathname.includes('/chat') || pathname.includes('/smart-chat')) {
      const chatTranslation = useChatTranslation();
      isTranslating = chatTranslation?.isTranslating || false;
      translationProgress = chatTranslation?.progress || 0;
    } else if (pathname.includes('/settings')) {
      const settingsTranslation = useSettingsTranslation();
      isTranslating = settingsTranslation?.isTranslating || false;
      translationProgress = settingsTranslation?.progress || 0;
    } else if (pathname.includes('/insights')) {
      const insightsTranslation = useInsightsTranslation();
      isTranslating = insightsTranslation?.isTranslating || false;
      translationProgress = insightsTranslation?.progress || 0;
    }
  } catch (error) {
    // Silently handle cases where page-specific context isn't available
    return null;
  }

  return (
    <AnimatePresence>
      {isTranslating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center"
        >
          <div className="flex flex-col items-center gap-6 max-w-md mx-auto px-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <Progress value={translationProgress} className="w-full" />
            <p className="text-sm text-muted-foreground">
              Translating content... {translationProgress}%
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
