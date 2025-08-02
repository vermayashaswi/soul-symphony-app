
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useNetworkStatus } from '@/utils/network';
import { Skeleton } from '@/components/ui/skeleton';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { logger } from '@/utils/logger';
import { TOAST_MESSAGES, showSuccessToast, showErrorToast, showInfoToast } from '@/utils/toast-messages';

interface NetworkAwareContentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  lowBandwidthFallback?: React.ReactNode;
  offlineFallback?: React.ReactNode;
  retryOnReconnect?: boolean;
}

export function NetworkAwareContent({
  children,
  fallback = <Skeleton className="h-40 w-full" />,
  lowBandwidthFallback,
  offlineFallback,
  retryOnReconnect = true,
}: NetworkAwareContentProps) {
  const networkStatus = useNetworkStatus();
  const { translate } = useTranslation();
  const [shouldRender, setShouldRender] = useState(true);
  const [hasReconnected, setHasReconnected] = useState(false);
  const [backOnlineMsg, setBackOnlineMsg] = useState<string>(TOAST_MESSAGES.NETWORK.BACK_ONLINE.title);
  const [backOnlineDesc, setBackOnlineDesc] = useState<string>(TOAST_MESSAGES.NETWORK.BACK_ONLINE.description);
  const [offlineMsg, setOfflineMsg] = useState<string>(TOAST_MESSAGES.NETWORK.OFFLINE_MODE.title);
  const [offlineDesc, setOfflineDesc] = useState<string>(TOAST_MESSAGES.NETWORK.OFFLINE_MODE.description);
  const [slowConnectionMsg, setSlowConnectionMsg] = useState('Slow connection detected');
  const [slowConnectionDesc, setSlowConnectionDesc] = useState('Loading optimized content for your connection speed.');
  
  const componentLogger = logger.createLogger('NetworkAwareContent');
  
  useEffect(() => {
    // Pre-translate common toast messages
    const preTranslateToastMessages = async () => {
      if (translate) {
        try {
          componentLogger.debug('Pre-translating toast messages');
          
          // Translate and store the messages
          const translatedBackOnline = await translate(TOAST_MESSAGES.NETWORK.BACK_ONLINE.title, "en");
          if (translatedBackOnline) setBackOnlineMsg(translatedBackOnline);
          
          const translatedBackOnlineDesc = await translate(TOAST_MESSAGES.NETWORK.BACK_ONLINE.description, "en");
          if (translatedBackOnlineDesc) setBackOnlineDesc(translatedBackOnlineDesc);
          
          const translatedOffline = await translate(TOAST_MESSAGES.NETWORK.OFFLINE_MODE.title, "en");
          if (translatedOffline) setOfflineMsg(translatedOffline);
          
          const translatedOfflineDesc = await translate(TOAST_MESSAGES.NETWORK.OFFLINE_MODE.description, "en");
          if (translatedOfflineDesc) setOfflineDesc(translatedOfflineDesc);
          
          const translatedSlowConnection = await translate("Slow connection detected", "en");
          if (translatedSlowConnection) setSlowConnectionMsg(translatedSlowConnection);
          
          const translatedSlowConnectionDesc = await translate("Loading optimized content for your connection speed.", "en");
          if (translatedSlowConnectionDesc) setSlowConnectionDesc(translatedSlowConnectionDesc);
          
          componentLogger.debug('Pre-translation complete');
        } catch (error) {
          componentLogger.error('Error pre-translating network messages', error);
        }
      }
    };
    
    preTranslateToastMessages();
    
    // Handle reconnection
    if (networkStatus.online && !shouldRender && retryOnReconnect) {
      setShouldRender(true);
      setHasReconnected(true);
      
      showSuccessToast(backOnlineMsg, backOnlineDesc, 3000);
    }
    
    // Handle offline state
    if (!networkStatus.online && shouldRender) {
      setShouldRender(false);
      
      showErrorToast(offlineMsg, offlineDesc, 5000);
    }
    
    // Handle slow connection
    if (networkStatus.online && networkStatus.speed === 'slow' && !hasReconnected) {
      showInfoToast(slowConnectionMsg, slowConnectionDesc, 3000);
    }
  }, [networkStatus.online, networkStatus.speed, shouldRender, retryOnReconnect, hasReconnected, translate]);
  
  // Listen for language changes to update toast messages
  useEffect(() => {
    const handleLanguageChange = async () => {
      if (translate) {
        try {
          // Update translated messages
          const translatedBackOnline = await translate(TOAST_MESSAGES.NETWORK.BACK_ONLINE.title, "en");
          if (translatedBackOnline) setBackOnlineMsg(translatedBackOnline);
          
          const translatedBackOnlineDesc = await translate(TOAST_MESSAGES.NETWORK.BACK_ONLINE.description, "en");
          if (translatedBackOnlineDesc) setBackOnlineDesc(translatedBackOnlineDesc);
          
          const translatedOffline = await translate(TOAST_MESSAGES.NETWORK.OFFLINE_MODE.title, "en");
          if (translatedOffline) setOfflineMsg(translatedOffline);
          
          const translatedOfflineDesc = await translate(TOAST_MESSAGES.NETWORK.OFFLINE_MODE.description, "en");
          if (translatedOfflineDesc) setOfflineDesc(translatedOfflineDesc);
          
          const translatedSlowConnection = await translate("Slow connection detected", "en");
          if (translatedSlowConnection) setSlowConnectionMsg(translatedSlowConnection);
          
          const translatedSlowConnectionDesc = await translate("Loading optimized content for your connection speed.", "en");
          if (translatedSlowConnectionDesc) setSlowConnectionDesc(translatedSlowConnectionDesc);
        } catch (error) {
          componentLogger.error('Error updating translated network messages', error);
        }
      }
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [translate]);
  
  if (!networkStatus.online && offlineFallback) {
    return <>{offlineFallback}</>;
  }
  
  if (networkStatus.online && networkStatus.speed === 'slow' && lowBandwidthFallback) {
    return <>{lowBandwidthFallback}</>;
  }
  
  return (
    <Suspense fallback={fallback}>
      {shouldRender ? children : fallback}
    </Suspense>
  );
}

export default NetworkAwareContent;
