import React, { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { HomeTranslationProvider } from './HomeTranslationProvider';
import { JournalTranslationProvider } from './JournalTranslationProvider';
import { ChatTranslationProvider } from './ChatTranslationProvider';
import { SettingsTranslationProvider } from './SettingsTranslationProvider';
import { InsightsTranslationProvider } from '../insights/InsightsTranslationProvider';
import { TranslationProgressIndicator } from '../insights/TranslationProgressIndicator';

interface PageTranslationWrapperProps {
  children: ReactNode;
}

export const PageTranslationWrapper: React.FC<PageTranslationWrapperProps> = ({ children }) => {
  const location = useLocation();
  const pathname = location.pathname;

  // Determine which translation provider to use based on the current route
  const getTranslationProvider = () => {
    if (pathname.includes('/home')) {
      return HomeTranslationProvider;
    } else if (pathname.includes('/journal')) {
      return JournalTranslationProvider;
    } else if (pathname.includes('/chat') || pathname.includes('/smart-chat')) {
      return ChatTranslationProvider;
    } else if (pathname.includes('/settings')) {
      return SettingsTranslationProvider;
    } else if (pathname.includes('/insights')) {
      return InsightsTranslationProvider;
    }
    
    // Default to no provider for other routes
    return null;
  };

  const TranslationProvider = getTranslationProvider();

  // If no specific provider is needed, return children without wrapper
  if (!TranslationProvider) {
    return <>{children}</>;
  }

  return (
    <TranslationProvider>
      <TranslationProgressIndicator />
      {children}
    </TranslationProvider>
  );
};