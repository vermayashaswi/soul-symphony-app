import React, { createContext, useContext, ReactNode } from 'react';
import { usePageTranslation } from '@/hooks/use-page-translation';

interface JournalTranslationContextType {
  isTranslating: boolean;
  progress: number;
  getTranslation: (text: string) => string | null;
  retryTranslation: () => void;
}

const JournalTranslationContext = createContext<JournalTranslationContextType | undefined>(undefined);

interface JournalTranslationProviderProps {
  children: ReactNode;
}

// Common texts used throughout the Journal page
const JOURNAL_PAGE_TEXTS = [
  'Journal',
  'Your voice entries',
  'Record new entry',
  'Search entries',
  'Filter by date',
  'All entries',
  'Today',
  'This week',
  'This month',
  'Sort by',
  'Date',
  'Duration',
  'Mood',
  'New Entry',
  'Start recording',
  'Stop recording',
  'Save entry',
  'Discard',
  'Play',
  'Pause',
  'Delete',
  'Edit',
  'Share',
  'Transcription',
  'Processing...',
  'No entries found',
  'Start your first journal entry',
  'Tap to record',
  'Hold to record',
  'Recording...',
  'Processing audio...',
  'Analyzing mood...',
  'Entry saved',
  'Failed to save',
  'Retry',
  'minutes ago',
  'hours ago',
  'days ago',
  'weeks ago',
  'months ago',
  'View more',
  'Show less',
  'Transcript',
  'Summary',
  'Emotions detected',
  'Life areas',
  'Tags',
  'Duration:',
  'Word count:',
  'Export',
  'Import',
  'Backup'
];

export const JournalTranslationProvider: React.FC<JournalTranslationProviderProps> = ({ children }) => {
  const pageTranslation = usePageTranslation({
    pageTexts: JOURNAL_PAGE_TEXTS,
    route: '/journal',
    enabled: true
  });

  const value: JournalTranslationContextType = {
    isTranslating: pageTranslation.isTranslating,
    progress: pageTranslation.progress,
    getTranslation: pageTranslation.getTranslation,
    retryTranslation: pageTranslation.retryTranslation
  };

  return (
    <JournalTranslationContext.Provider value={value}>
      {children}
    </JournalTranslationContext.Provider>
  );
};

export const useJournalTranslation = (): JournalTranslationContextType => {
  const context = useContext(JournalTranslationContext);
  if (context === undefined) {
    throw new Error('useJournalTranslation must be used within a JournalTranslationProvider');
  }
  return context;
};