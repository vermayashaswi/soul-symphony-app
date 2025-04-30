
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
  
  useEffect(() => {
    // Pre-translate common toast messages
    const preTranslateToastMessages = async () => {
      if (translate) {
        try {
          await translate("Back online", "en");
          await translate("Your connection has been restored.", "en");
          await translate("You're offline", "en");
          await translate("Some content may not be available.", "en");
          await translate("Slow connection detected", "en");
          await translate("Loading optimized content for your connection speed.", "en");
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
        title: "Back online",
        description: "Your connection has been restored.",
        duration: 3000,
      });
    }
    
    // Handle offline state
    if (!networkStatus.online && shouldRender) {
      setShouldRender(false);
      
      toast({
        title: "You're offline",
        description: "Some content may not be available.",
        variant: "destructive",
        duration: 5000,
      });
    }
    
    // Handle slow connection
    if (networkStatus.online && networkStatus.speed === 'slow' && !hasReconnected) {
      toast({
        title: "Slow connection detected",
        description: "Loading optimized content for your connection speed.",
        duration: 3000,
      });
    }
  }, [networkStatus.online, networkStatus.speed, shouldRender, retryOnReconnect, hasReconnected, toast, translate]);
  
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
