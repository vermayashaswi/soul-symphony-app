
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Trash2, Wifi, WifiOff, Smartphone, Globe } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { versionService } from '@/services/versionService';
import { featureFlagService } from '@/services/featureFlagService';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';

export const PWADebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [swStatus, setSWStatus] = useState<any>(null);
  const [cacheInfo, setCacheInfo] = useState<any>({});
  const { flags, refreshFlags } = useFeatureFlagsContext();

  useEffect(() => {
    const updateStatus = async () => {
      try {
        // Get service worker info
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          setSWStatus({
            state: registration.active?.state,
            scriptURL: registration.active?.scriptURL,
            scope: registration.scope
          });
        }

        // Get cache info
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          const cacheDetails = await Promise.all(
            cacheNames.map(async (name) => {
              const cache = await caches.open(name);
              const keys = await cache.keys();
              return { name, size: keys.length };
            })
          );
          setCacheInfo({ names: cacheNames, details: cacheDetails });
        }
      } catch (error) {
        console.error('[PWADebugPanel] Error updating status:', error);
      }
    };

    if (isOpen) {
      updateStatus();
    }
  }, [isOpen]);

  const clearCaches = async () => {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      setCacheInfo({ names: [], details: [] });
      console.log('[PWADebugPanel] All caches cleared');
    } catch (error) {
      console.error('[PWADebugPanel] Error clearing caches:', error);
    }
  };

  const forceUpdate = async () => {
    try {
      await versionService.forceUpdate();
    } catch (error) {
      console.error('[PWADebugPanel] Error forcing update:', error);
    }
  };

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-sm">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="mb-2">
            PWA Debug
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <Card className="p-4 bg-background/95 backdrop-blur border">
            <div className="space-y-4">
              {/* Platform Info */}
              <div>
                <h4 className="font-semibold mb-2">Platform</h4>
                <div className="flex gap-2">
                  <Badge variant={versionService.isPWAMode() ? "default" : "secondary"}>
                    {versionService.isPWAMode() ? (
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
                  
                  <Badge variant={versionService.isPWABuilderApp() ? "default" : "secondary"}>
                    PWABuilder: {versionService.isPWABuilderApp() ? 'Yes' : 'No'}
                  </Badge>
                  
                  <Badge variant={navigator.onLine ? "default" : "destructive"}>
                    {navigator.onLine ? (
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
                </div>
              </div>

              {/* Version Info */}
              <div>
                <h4 className="font-semibold mb-2">Version</h4>
                <Badge variant="outline">
                  v{versionService.getCurrentVersion()}
                </Badge>
              </div>

              {/* Service Worker Info */}
              {swStatus && (
                <div>
                  <h4 className="font-semibold mb-2">Service Worker</h4>
                  <div className="text-xs space-y-1">
                    <div>State: <Badge variant="outline">{swStatus.state}</Badge></div>
                    <div>Scope: {swStatus.scope}</div>
                  </div>
                </div>
              )}

              {/* Cache Info */}
              <div>
                <h4 className="font-semibold mb-2">Caches ({cacheInfo.names?.length || 0})</h4>
                {cacheInfo.details?.map((cache: any) => (
                  <div key={cache.name} className="text-xs">
                    {cache.name}: {cache.size} items
                  </div>
                ))}
              </div>

              {/* Feature Flags */}
              <div>
                <h4 className="font-semibold mb-2">Feature Flags</h4>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {Object.entries(flags).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${value ? 'bg-green-500' : 'bg-gray-300'}`} />
                      {key}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearCaches}
                  className="flex-1"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear Cache
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={forceUpdate}
                  className="flex-1"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Force Update
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={refreshFlags}
                className="w-full"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh Flags
              </Button>
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
