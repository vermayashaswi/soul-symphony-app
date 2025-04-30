
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useNetworkStatus } from '@/utils/network';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { TranslatableText } from '@/components/translation/TranslatableText';

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
  const [shouldRender, setShouldRender] = useState(true);
  const [hasReconnected, setHasReconnected] = useState(false);
  
  useEffect(() => {
    // Handle reconnection
    if (networkStatus.online && !shouldRender && retryOnReconnect) {
      setShouldRender(true);
      setHasReconnected(true);
      
      toast({
        title: <TranslatableText text="Back online" />,
        description: <TranslatableText text="Your connection has been restored." />,
        duration: 3000,
      });
    }
    
    // Handle offline state
    if (!networkStatus.online && shouldRender) {
      setShouldRender(false);
      
      toast({
        title: <TranslatableText text="You're offline" />,
        description: <TranslatableText text="Some content may not be available." />,
        variant: "destructive",
        duration: 5000,
      });
    }
    
    // Handle slow connection
    if (networkStatus.online && networkStatus.speed === 'slow' && !hasReconnected) {
      toast({
        title: <TranslatableText text="Slow connection detected" />,
        description: <TranslatableText text="Loading optimized content for your connection speed." />,
        duration: 3000,
      });
    }
  }, [networkStatus.online, networkStatus.speed, shouldRender, retryOnReconnect, hasReconnected, toast]);
  
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
