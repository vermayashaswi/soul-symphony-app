import React, { createContext, useContext, ReactNode } from 'react';
import { usePageTranslation } from '@/hooks/use-page-translation';

interface HomeTranslationContextType {
  isTranslating: boolean;
  progress: number;
  getTranslation: (text: string) => string | null;
  retryTranslation: () => void;
}

const HomeTranslationContext = createContext<HomeTranslationContextType | undefined>(undefined);

interface HomeTranslationProviderProps {
  children: ReactNode;
}

// Common texts used throughout the Home page
const HOME_PAGE_TEXTS = [
  'Welcome to Soulo',
  'Your AI Voice Journal',
  'Start recording your thoughts',
  'Record',
  'Journal',
  'Insights',
  'Chat',
  'Settings',
  'Good morning',
  'Good afternoon', 
  'Good evening',
  'How are you feeling today?',
  'Record your thoughts',
  'View your insights',
  'Chat with AI',
  'Recent entries',
  'View all entries',
  'Quick actions',
  'Get started',
  'New entry',
  'Continue journaling',
  'Explore your emotions',
  'Talk to your AI companion',
  'No entries yet',
  'Start your journaling journey',
  'Your emotional wellness companion',
  'Track your mood',
  'Discover patterns',
  'Get insights',
  'Daily reflection'
];

export const HomeTranslationProvider: React.FC<HomeTranslationProviderProps> = ({ children }) => {
  const pageTranslation = usePageTranslation({
    pageTexts: HOME_PAGE_TEXTS,
    route: '/home',
    enabled: true
  });

  const value: HomeTranslationContextType = {
    isTranslating: pageTranslation.isTranslating,
    progress: pageTranslation.progress,
    getTranslation: pageTranslation.getTranslation,
    retryTranslation: pageTranslation.retryTranslation
  };

  return (
    <HomeTranslationContext.Provider value={value}>
      {children}
    </HomeTranslationContext.Provider>
  );
};

export const useHomeTranslation = (): HomeTranslationContextType => {
  const context = useContext(HomeTranslationContext);
  if (context === undefined) {
    throw new Error('useHomeTranslation must be used within a HomeTranslationProvider');
  }
  return context;
};