
import React from 'react';
import { useNetworkStatus } from '@/utils/network';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  className?: string;
  showSpeed?: boolean;
}

export function ConnectionStatus({ 
  className, 
  showSpeed = false 
}: ConnectionStatusProps) {
  const networkStatus = useNetworkStatus();
  
  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      {networkStatus.online ? (
        <>
          <Wifi className={cn(
            "h-4 w-4",
            networkStatus.speed === 'slow' && "text-orange-500",
            networkStatus.speed === 'medium' && "text-green-500",
            networkStatus.speed === 'fast' && "text-green-600"
          )} />
          {showSpeed && (
            <span className={cn(
              networkStatus.speed === 'slow' && "text-orange-500",
              networkStatus.speed === 'medium' && "text-green-500", 
              networkStatus.speed === 'fast' && "text-green-600"
            )}>
              {networkStatus.speed === 'slow' && "Slow connection"}
              {networkStatus.speed === 'medium' && "Good connection"}
              {networkStatus.speed === 'fast' && "Fast connection"}
              {networkStatus.downlink && ` (${networkStatus.downlink.toFixed(1)} Mbps)`}
            </span>
          )}
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-red-500" />
          <span className="text-red-500">Offline</span>
        </>
      )}
    </div>
  );
}

export default ConnectionStatus;

