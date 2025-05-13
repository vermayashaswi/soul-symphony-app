
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useNetworkStatus } from '@/utils/network';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';

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
  const { toast } = useToast();
  const { translate } = useTranslation();
  const [shouldRender, setShouldRender] = useState(true);
  const [hasReconnected, setHasReconnected] = useState(false);
  const [backOnlineMsg, setBackOnlineMsg] = useState('Back online');
  const [backOnlineDesc, setBackOnlineDesc] = useState('Your connection has been restored.');
  const [offlineMsg, setOfflineMsg] = useState('You\'re offline');
  const [offlineDesc, setOfflineDesc] = useState('Some content may not be available.');
  const [slowConnectionMsg, setSlowConnectionMsg] = useState('Slow connection detected');
  const [slowConnectionDesc, setSlowConnectionDesc] = useState('Loading optimized content for your connection speed.');
  
  useEffect(() => {
    // Pre-translate common toast messages
    const preTranslateToastMessages = async () => {
      if (translate) {
        try {
          console.log('NetworkAwareContent: Pre-translating toast messages...');
          
          // Translate and store the messages
          const translatedBackOnline = await translate("Back online", "en");
          if (translatedBackOnline) setBackOnlineMsg(translatedBackOnline);
          
          const translatedBackOnlineDesc = await translate("Your connection has been restored.", "en");
          if (translatedBackOnlineDesc) setBackOnlineDesc(translatedBackOnlineDesc);
          
          const translatedOffline = await translate("You're offline", "en");
          if (translatedOffline) setOfflineMsg(translatedOffline);
          
          const translatedOfflineDesc = await translate("Some content may not be available.", "en");
          if (translatedOfflineDesc) setOfflineDesc(translatedOfflineDesc);
          
          const translatedSlowConnection = await translate("Slow connection detected", "en");
          if (translatedSlowConnection) setSlowConnectionMsg(translatedSlowConnection);
          
          const translatedSlowConnectionDesc = await translate("Loading optimized content for your connection speed.", "en");
          if (translatedSlowConnectionDesc) setSlowConnectionDesc(translatedSlowConnectionDesc);
          
          console.log('NetworkAwareContent: Pre-translation complete');
        } catch (error) {
          console.error("Error pre-translating network messages:", error);
        }
      }
    };
    
    preTranslateToastMessages();
    
    // Handle reconnection
    if (networkStatus.online && !shouldRender && retryOnReconnect) {
      setShouldRender(true);
      setHasReconnected(true);
      
      toast({
        title: backOnlineMsg,
        description: backOnlineDesc,
        duration: 3000,
      });
    }
    
    // Handle offline state
    if (!networkStatus.online && shouldRender) {
      setShouldRender(false);
      
      toast({
        title: offlineMsg,
        description: offlineDesc,
        duration: 5000,
      });
    }
    
    // Handle slow connection
    if (networkStatus.online && networkStatus.speed === 'slow' && !hasReconnected) {
      toast({
        title: slowConnectionMsg,
        description: slowConnectionDesc,
        duration: 3000,
      });
    }
  }, [networkStatus.online, networkStatus.speed, shouldRender, retryOnReconnect, hasReconnected, toast, translate]);
  
  // Listen for language changes to update toast messages
  useEffect(() => {
    const handleLanguageChange = async () => {
      if (translate) {
        try {
          // Update translated messages
          const translatedBackOnline = await translate("Back online", "en");
          if (translatedBackOnline) setBackOnlineMsg(translatedBackOnline);
          
          const translatedBackOnlineDesc = await translate("Your connection has been restored.", "en");
          if (translatedBackOnlineDesc) setBackOnlineDesc(translatedBackOnlineDesc);
          
          const translatedOffline = await translate("You're offline", "en");
          if (translatedOffline) setOfflineMsg(translatedOffline);
          
          const translatedOfflineDesc = await translate("Some content may not be available.", "en");
          if (translatedOfflineDesc) setOfflineDesc(translatedOfflineDesc);
          
          const translatedSlowConnection = await translate("Slow connection detected", "en");
          if (translatedSlowConnection) setSlowConnectionMsg(translatedSlowConnection);
          
          const translatedSlowConnectionDesc = await translate("Loading optimized content for your connection speed.", "en");
          if (translatedSlowConnectionDesc) setSlowConnectionDesc(translatedSlowConnectionDesc);
        } catch (error) {
          console.error("Error updating translated network messages:", error);
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
