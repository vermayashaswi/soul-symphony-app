
import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Globe, Wifi, WifiOff } from 'lucide-react';
import { versionService } from '@/services/versionService';
import { cn } from '@/lib/utils';

interface PWAStatus {
  isPWA: boolean;
  isPWABuilder: boolean;
  isOnline: boolean;
  version: string;
}

export const PWAStatusIndicator: React.FC<{ className?: string }> = ({ className }) => {
  const [status, setStatus] = useState<PWAStatus>({
    isPWA: false,
    isPWABuilder: false,
    isOnline: navigator.onLine,
    version: '1.0.0'
  });

  useEffect(() => {
    const updateStatus = () => {
      setStatus({
        isPWA: versionService.isPWAMode(),
        isPWABuilder: versionService.isPWABuilderApp(),
        isOnline: navigator.onLine,
        version: versionService.getCurrentVersion()
      });
    };

    // Initial status
    updateStatus();

    // Listen for online/offline changes
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Only show in development or when there are issues
  const shouldShow = import.meta.env.MODE === 'development' || 
                    !status.isOnline || 
                    status.isPWABuilder;

  if (!shouldShow) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Platform indicator */}
      <Badge 
        variant={status.isPWABuilder ? "default" : "secondary"}
        className="text-xs"
      >
        {status.isPWABuilder ? (
          <>
            <Smartphone className="h-3 w-3 mr-1" />
            Native
          </>
        ) : status.isPWA ? (
          <>
            <Smartphone className="h-3 w-3 mr-1" />
            PWA
          </>
        ) : (
          <>
            <Globe className="h-3 w-3 mr-1" />
            Web
          </>
        )}
      </Badge>

      {/* Connection status */}
      <Badge 
        variant={status.isOnline ? "default" : "destructive"}
        className="text-xs"
      >
        {status.isOnline ? (
          <>
            <Wifi className="h-3 w-3 mr-1" />
            Online
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 mr-1" />
            Offline
          </>
        )}
      </Badge>

      {/* Version in development */}
      {import.meta.env.MODE === 'development' && (
        <Badge variant="outline" className="text-xs">
          v{status.version}
        </Badge>
      )}
    </div>
  );
};
