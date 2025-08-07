import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNonBlockingRevenueCat } from '@/hooks/useNonBlockingRevenueCat';
import { logger } from '@/utils/logger';

/**
 * Background subscription initializer that runs AFTER splash screen is hidden
 * This prevents subscription/RevenueCat initialization from blocking the splash screen
 */
export const BackgroundSubscriptionInitializer: React.FC = () => {
  const { user } = useAuth();
  const backgroundLogger = logger.createLogger('BackgroundSubscription');
  
  // This hook will initialize RevenueCat in the background without blocking
  const {
    isInitialized,
    isInitializing,
    initializationFailed,
    retryInitialization
  } = useNonBlockingRevenueCat();

  useEffect(() => {
    if (user && !isInitialized && !isInitializing) {
      backgroundLogger.info('Starting background subscription initialization');
      
      // Add a small delay to ensure splash screen has been hidden first
      const delayedInit = setTimeout(() => {
        backgroundLogger.debug('Background subscription initialization delay complete');
        // The hook will handle initialization automatically
      }, 1000); // 1 second delay after splash screen

      return () => clearTimeout(delayedInit);
    }
  }, [user, isInitialized, isInitializing, backgroundLogger]);

  useEffect(() => {
    if (initializationFailed) {
      backgroundLogger.warn('Background subscription initialization failed, will retry');
      
      // Retry after a delay if initialization failed
      const retryTimeout = setTimeout(() => {
        backgroundLogger.info('Retrying background subscription initialization');
        retryInitialization();
      }, 5000); // 5 second retry delay

      return () => clearTimeout(retryTimeout);
    }
  }, [initializationFailed, retryInitialization, backgroundLogger]);

  useEffect(() => {
    if (isInitialized) {
      backgroundLogger.info('Background subscription initialization completed successfully');
    }
  }, [isInitialized, backgroundLogger]);

  // This component doesn't render anything - it's purely for background initialization
  return null;
};