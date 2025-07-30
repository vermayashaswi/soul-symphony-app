import React, { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { HomeTranslationProvider } from './HomeTranslationProvider';
import { JournalTranslationProvider } from './JournalTranslationProvider';
import { ChatTranslationProvider } from './ChatTranslationProvider';
import { SettingsTranslationProvider } from './SettingsTranslationProvider';
import { InsightsTranslationProvider } from '../insights/InsightsTranslationProvider';
import { GenericTranslationProgress } from './GenericTranslationProgress';

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
      {(function() {
        // Get translation state based on provider type
        if (pathname.includes('/home')) {
          const HomeProvider = TranslationProvider as any;
          return (
            <>
              <HomeProvider.Consumer>
                {(value: any) => (
                  <GenericTranslationProgress 
                    isTranslating={value?.isTranslating || false}
                    progress={value?.progress || 0}
                  />
                )}
              </HomeProvider.Consumer>
              {children}
            </>
          );
        } else if (pathname.includes('/journal')) {
          const JournalProvider = TranslationProvider as any;
          return (
            <>
              <JournalProvider.Consumer>
                {(value: any) => (
                  <GenericTranslationProgress 
                    isTranslating={value?.isTranslating || false}
                    progress={value?.progress || 0}
                  />
                )}
              </JournalProvider.Consumer>
              {children}
            </>
          );
        } else if (pathname.includes('/chat') || pathname.includes('/smart-chat')) {
          const ChatProvider = TranslationProvider as any;
          return (
            <>
              <ChatProvider.Consumer>
                {(value: any) => (
                  <GenericTranslationProgress 
                    isTranslating={value?.isTranslating || false}
                    progress={value?.progress || 0}
                  />
                )}
              </ChatProvider.Consumer>
              {children}
            </>
          );
        } else if (pathname.includes('/settings')) {
          const SettingsProvider = TranslationProvider as any;
          return (
            <>
              <SettingsProvider.Consumer>
                {(value: any) => (
                  <GenericTranslationProgress 
                    isTranslating={value?.isTranslating || false}
                    progress={value?.progress || 0}
                  />
                )}
              </SettingsProvider.Consumer>
              {children}
            </>
          );
        } else if (pathname.includes('/insights')) {
          const InsightsProvider = TranslationProvider as any;
          return (
            <>
              <InsightsProvider.Consumer>
                {(value: any) => (
                  <GenericTranslationProgress 
                    isTranslating={value?.isTranslating || false}
                    progress={value?.progress || 0}
                  />
                )}
              </InsightsProvider.Consumer>
              {children}
            </>
          );
        }
        return children;
      })()}
    </TranslationProvider>
  );
};