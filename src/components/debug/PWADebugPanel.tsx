
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bug, 
  Settings, 
  Database, 
  Wifi, 
  Flag,
  RefreshCw,
  Trash2,
  Download
} from 'lucide-react';
import { versionService, AppVersion } from '@/services/versionService';
import { featureFlagService, FeatureFlagConfig } from '@/services/featureFlagService';
import { serviceWorkerManager } from '@/utils/serviceWorker';
import { AppFeatureFlag } from '@/types/featureFlags';
import { toast } from 'sonner';

const PWADebugPanel: React.FC = () => {
  const [version, setVersion] = useState<AppVersion | null>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagConfig[]>([]);
  const [swStatus, setSwStatus] = useState({
    registered: false,
    capabilities: {
      backgroundSync: false,
      pushNotifications: false,
      periodicSync: false
    }
  });
  const [cacheInfo, setCacheInfo] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadDebugInfo();
  }, []);

  const loadDebugInfo = async () => {
    try {
      // Load version info
      const currentVersion = versionService.getCurrentVersion();
      setVersion(currentVersion);

      // Load feature flags
      const flags = await featureFlagService.getAllConfigs();
      setFeatureFlags(flags);

      // Load service worker status
      const capabilities = serviceWorkerManager.getCapabilities();
      setSwStatus({
        registered: serviceWorkerManager.isServiceWorkerRegistered(),
        capabilities
      });

      // Load cache info
      const cacheNames = await caches.keys();
      setCacheInfo(cacheNames);

    } catch (error) {
      console.error('[PWADebugPanel] Error loading debug info:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDebugInfo();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleToggleFlag = async (flag: AppFeatureFlag, enabled: boolean) => {
    try {
      const success = await featureFlagService.updateFlag(flag, enabled);
      if (success) {
        toast.success(`Feature flag ${flag} ${enabled ? 'enabled' : 'disabled'}`);
        await loadDebugInfo();
      } else {
        toast.error('Failed to update feature flag');
      }
    } catch (error) {
      console.error('[PWADebugPanel] Error toggling flag:', error);
      toast.error('Error updating feature flag');
    }
  };

  const handleClearCache = async () => {
    try {
      await versionService.clearCache();
      toast.success('Cache cleared successfully');
      await loadDebugInfo();
    } catch (error) {
      toast.error('Failed to clear cache');
    }
  };

  const handleForceUpdate = async () => {
    try {
      const updateInfo = await versionService.checkForUpdates();
      if (updateInfo.available) {
        await versionService.applyUpdate();
      } else {
        toast.info('No updates available');
      }
    } catch (error) {
      toast.error('Update check failed');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bug className="w-5 h-5" />
            <span>PWA Debug Panel</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          Monitor PWA status, feature flags, and cache information
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="version" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="version">Version</TabsTrigger>
            <TabsTrigger value="flags">Flags</TabsTrigger>
            <TabsTrigger value="cache">Cache</TabsTrigger>
            <TabsTrigger value="service">Service</TabsTrigger>
          </TabsList>

          <TabsContent value="version" className="space-y-4">
            {version && (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="font-medium">Version:</span>
                  <span>{version.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Build Date:</span>
                  <span>{new Date(version.buildDate).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Cache Version:</span>
                  <span>{version.cacheVersion}</span>
                </div>
                <div className="space-y-2">
                  <span className="font-medium">Features:</span>
                  <div className="flex flex-wrap gap-1">
                    {version.features.map(feature => (
                      <Badge key={feature} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button onClick={handleForceUpdate} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Check for Updates
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="flags" className="space-y-4">
            <ScrollArea className="h-60">
              <div className="space-y-3">
                {featureFlags.map(flag => (
                  <div key={flag.flag} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <div className="font-medium">{flag.flag}</div>
                      {flag.description && (
                        <div className="text-sm text-muted-foreground">
                          {flag.description}
                        </div>
                      )}
                    </div>
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={(enabled) => handleToggleFlag(flag.flag, enabled)}
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="cache" className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Cache Stores:</span>
                <Badge variant="outline">{cacheInfo.length}</Badge>
              </div>
              <ScrollArea className="h-40">
                <div className="space-y-1">
                  {cacheInfo.map(cacheName => (
                    <div key={cacheName} className="text-sm font-mono p-2 bg-muted rounded">
                      {cacheName}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <Button
                variant="destructive"
                onClick={handleClearCache}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All Caches
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="service" className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="font-medium">Service Worker:</span>
                <Badge variant={swStatus.registered ? "default" : "destructive"}>
                  {swStatus.registered ? "Registered" : "Not Registered"}
                </Badge>
              </div>
              <div className="space-y-2">
                <span className="font-medium">Capabilities:</span>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Background Sync:</span>
                    <Badge variant={swStatus.capabilities.backgroundSync ? "default" : "secondary"}>
                      {swStatus.capabilities.backgroundSync ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Push Notifications:</span>
                    <Badge variant={swStatus.capabilities.pushNotifications ? "default" : "secondary"}>
                      {swStatus.capabilities.pushNotifications ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Periodic Sync:</span>
                    <Badge variant={swStatus.capabilities.periodicSync ? "default" : "secondary"}>
                      {swStatus.capabilities.periodicSync ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PWADebugPanel;
