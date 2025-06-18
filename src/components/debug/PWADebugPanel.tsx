
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Download, Trash2, Info, Wifi, WifiOff, Smartphone, Monitor } from 'lucide-react';
import { versionService } from '@/services/versionService';
import { useTheme } from '@/hooks/use-theme';

export function PWADebugPanel() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [cacheSize, setCacheSize] = useState<string>('Calculating...');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const { theme, colorTheme, systemTheme } = useTheme();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Check if app is already installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    const getCacheSize = async () => {
      const size = await versionService.getCacheSize();
      setCacheSize(size);
    };
    
    getCacheSize();
  }, []);

  useEffect(() => {
    const checkForUpdates = async () => {
      const updateInfo = await versionService.checkForUpdates();
      setUpdateAvailable(updateInfo.available);
    };
    
    checkForUpdates();
  }, []);

  const handleInstallApp = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      setInstallPrompt(null);
    }
  };

  const handleClearCache = async () => {
    await versionService.clearCache();
    setCacheSize('Cleared');
    setTimeout(async () => {
      const size = await versionService.getCacheSize();
      setCacheSize(size);
    }, 1000);
  };

  const handleForceUpdate = async () => {
    const success = await versionService.forceUpdate();
    if (success) {
      console.log('Force update initiated');
    }
  };

  const currentVersion = versionService.getCurrentVersion();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          PWA Status & Debug
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Network Status</span>
              <Badge variant={isOnline ? "default" : "destructive"} className="flex items-center gap-1">
                {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {isOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Installation Status</span>
              <Badge variant={isInstalled ? "default" : "secondary"} className="flex items-center gap-1">
                {isInstalled ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                {isInstalled ? 'Installed' : 'Browser'}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Theme</span>
              <Badge variant="outline">
                {theme} ({theme === 'system' ? systemTheme : theme}) / {colorTheme}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">App Version</span>
              <Badge variant="outline">{currentVersion.version}</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cache Size</span>
              <Badge variant="outline">{cacheSize}</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Updates</span>
              <Badge variant={updateAvailable ? "destructive" : "default"}>
                {updateAvailable ? 'Available' : 'Current'}
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-2">
          {!isInstalled && installPrompt && (
            <Button onClick={handleInstallApp} size="sm" className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              Install App
            </Button>
          )}
          
          <Button onClick={handleClearCache} variant="outline" size="sm" className="flex items-center gap-1">
            <Trash2 className="h-3 w-3" />
            Clear Cache
          </Button>
          
          <Button onClick={handleForceUpdate} variant="outline" size="sm" className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Force Update
          </Button>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <Info className="h-3 w-3" />
            Build: {currentVersion.buildDate.slice(0, 10)}
          </div>
          <div>Cache: {currentVersion.cacheVersion}</div>
          <div>Features: {currentVersion.features.join(', ')}</div>
        </div>
      </CardContent>
    </Card>
  );
}
