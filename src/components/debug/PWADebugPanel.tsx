
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Download, Trash2, Info, Wifi, WifiOff, Smartphone, Monitor, Bell, BellOff, AlertTriangle, CheckCircle } from 'lucide-react';
import { versionService } from '@/services/versionService';
import { useTheme } from '@/hooks/use-theme';

export function PWADebugPanel() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [cacheSize, setCacheSize] = useState<string>('Calculating...');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [lastUpdateCheck, setLastUpdateCheck] = useState<string>('Never');
  const [swVersion, setSwVersion] = useState<string>('Unknown');
  const [isUpdating, setIsUpdating] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [lastRefresh, setLastRefresh] = useState<string>('Never');
  const { theme, colorTheme, systemTheme } = useTheme();

  // Enhanced network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[PWADebugPanel] Network: Online');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      console.log('[PWADebugPanel] Network: Offline');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Enhanced PWA installation detection
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      console.log('[PWADebugPanel] Install prompt available');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Enhanced installation detection
    const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    const isWebView = navigator.userAgent.includes('wv') || navigator.userAgent.includes('WebView');
    
    setIsInstalled(isStandalone || isIOSStandalone || isWebView);
    
    console.log('[PWADebugPanel] Installation status:', { isStandalone, isIOSStandalone, isWebView });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Enhanced initialization with comprehensive data gathering
  useEffect(() => {
    const initializeData = async () => {
      console.log('[PWADebugPanel] Initializing comprehensive debug data...');
      
      try {
        // Get cache size
        const size = await versionService.getCacheSize();
        setCacheSize(size);
        
        // Enhanced service worker info
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const swInfo = {
            active: !!registration.active,
            waiting: !!registration.waiting,
            installing: !!registration.installing,
            scope: registration.scope,
            updateViaCache: registration.updateViaCache
          };
          
          setSwVersion(registration.active ? 'Active' : 'Inactive');
          setDebugInfo(prev => ({ ...prev, serviceWorker: swInfo }));
          
          console.log('[PWADebugPanel] Service worker info:', swInfo);
        }
        
        // Check for updates with enhanced detection
        const updateInfo = await versionService.checkForUpdates();
        setUpdateAvailable(updateInfo.available);
        setLastUpdateCheck(new Date().toLocaleTimeString());
        
        // Gather additional debug info
        const additionalInfo = {
          userAgent: navigator.userAgent,
          cookieEnabled: navigator.cookieEnabled,
          language: navigator.language,
          platform: navigator.platform,
          storage: {
            localStorage: !!window.localStorage,
            sessionStorage: !!window.sessionStorage,
            indexedDB: !!window.indexedDB
          },
          caches: !!window.caches,
          serviceWorkerSupport: 'serviceWorker' in navigator,
          pushManagerSupport: 'PushManager' in window,
          notificationSupport: 'Notification' in window
        };
        
        setDebugInfo(prev => ({ ...prev, ...additionalInfo }));
        
        console.log('[PWADebugPanel] Debug info gathered:', additionalInfo);
        
      } catch (error) {
        console.error('[PWADebugPanel] Failed to initialize data:', error);
        setDebugInfo(prev => ({ ...prev, initError: error.message }));
      }
    };
    
    initializeData();
  }, []);

  // Enhanced service worker message listening
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      console.log('[PWADebugPanel] Service worker message:', event.data);
      
      switch (event.data.type) {
        case 'UPDATE_AVAILABLE':
          setUpdateAvailable(true);
          setLastUpdateCheck(new Date().toLocaleTimeString());
          break;
        case 'SW_UPDATED':
        case 'SW_ACTIVATED':
          setUpdateAvailable(false);
          setLastUpdateCheck(new Date().toLocaleTimeString());
          setLastRefresh(new Date().toLocaleTimeString());
          break;
        case 'FORCE_REFRESH':
          setLastRefresh(new Date().toLocaleTimeString());
          break;
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleInstallApp = async () => {
    if (installPrompt) {
      console.log('[PWADebugPanel] Triggering install prompt');
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      console.log(`[PWADebugPanel] Install outcome: ${outcome}`);
      setInstallPrompt(null);
    }
  };

  const handleClearCache = async () => {
    console.log('[PWADebugPanel] Clearing cache...');
    setIsUpdating(true);
    
    try {
      await versionService.clearCache();
      setCacheSize('Cleared');
      
      setTimeout(async () => {
        const size = await versionService.getCacheSize();
        setCacheSize(size);
        setIsUpdating(false);
      }, 1000);
    } catch (error) {
      console.error('[PWADebugPanel] Cache clear failed:', error);
      setIsUpdating(false);
    }
  };

  const handleForceUpdate = async () => {
    console.log('[PWADebugPanel] Force update triggered');
    setIsUpdating(true);
    
    try {
      const success = await versionService.forceUpdate();
      if (success) {
        setUpdateAvailable(false);
        setLastUpdateCheck(new Date().toLocaleTimeString());
        setLastRefresh(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('[PWADebugPanel] Force update failed:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleManualUpdateCheck = async () => {
    console.log('[PWADebugPanel] Manual update check');
    setIsUpdating(true);
    
    try {
      await versionService.triggerManualUpdate();
      const updateInfo = await versionService.checkForUpdates();
      setUpdateAvailable(updateInfo.available);
      setLastUpdateCheck(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('[PWADebugPanel] Manual update check failed:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDiagnosticRefresh = () => {
    console.log('[PWADebugPanel] Diagnostic refresh triggered');
    const url = new URL(window.location.href);
    url.searchParams.set('_debug', Date.now().toString());
    url.searchParams.set('_v', versionService.getCurrentVersion().version);
    window.location.href = url.toString();
  };

  const currentVersion = versionService.getCurrentVersion();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Enhanced PWA Debug Panel
          <Badge variant="outline" className="text-xs">v{currentVersion.version}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Network</span>
              <Badge variant={isOnline ? "default" : "destructive"} className="flex items-center gap-1">
                {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {isOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Installation</span>
              <Badge variant={isInstalled ? "default" : "secondary"} className="flex items-center gap-1">
                {isInstalled ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                {isInstalled ? 'Installed' : 'Browser'}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Service Worker</span>
              <Badge variant={swVersion === 'Active' ? "default" : "secondary"}>
                {swVersion}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Theme</span>
              <Badge variant="outline" className="text-xs">
                {theme}/{colorTheme}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Version</span>
              <Badge variant="outline">{currentVersion.version}</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cache Size</span>
              <Badge variant="outline">{cacheSize}</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Updates</span>
              <Badge variant={updateAvailable ? "destructive" : "default"} className="flex items-center gap-1">
                {updateAvailable ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                {updateAvailable ? 'Available' : 'Current'}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Last Check</span>
              <Badge variant="outline" className="text-xs">{lastUpdateCheck}</Badge>
            </div>
          </div>
        </div>

        {/* Enhanced Status Info */}
        {lastRefresh !== 'Never' && (
          <div className="flex items-center justify-between p-2 bg-muted rounded">
            <span className="text-sm">Last Refresh:</span>
            <Badge variant="outline" className="text-xs">{lastRefresh}</Badge>
          </div>
        )}

        <Separator />

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {!isInstalled && installPrompt && (
            <Button onClick={handleInstallApp} size="sm" className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              Install App
            </Button>
          )}
          
          <Button 
            onClick={handleManualUpdateCheck} 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-1"
            disabled={isUpdating}
          >
            <RefreshCw className={`h-3 w-3 ${isUpdating ? 'animate-spin' : ''}`} />
            Check Updates
          </Button>
          
          {updateAvailable && (
            <Button 
              onClick={handleForceUpdate} 
              size="sm" 
              className="flex items-center gap-1"
              disabled={isUpdating}
            >
              <Download className="h-3 w-3" />
              Update Now
            </Button>
          )}
          
          <Button onClick={handleClearCache} variant="outline" size="sm" className="flex items-center gap-1" disabled={isUpdating}>
            <Trash2 className="h-3 w-3" />
            Clear Cache
          </Button>

          <Button onClick={handleDiagnosticRefresh} variant="outline" size="sm" className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Diagnostic Refresh
          </Button>
        </div>

        {/* Debug Information */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <Info className="h-3 w-3" />
            Build: {currentVersion.buildDate.slice(0, 10)}
          </div>
          <div>Cache: {currentVersion.cacheVersion}</div>
          <div>Features: {currentVersion.features.slice(0, 2).join(', ')}{currentVersion.features.length > 2 ? '...' : ''}</div>
          {debugInfo.serviceWorker && (
            <div>SW Scope: {debugInfo.serviceWorker.scope}</div>
          )}
          {debugInfo.userAgent && (
            <div>UA: {debugInfo.userAgent.slice(0, 50)}...</div>
          )}
          {updateAvailable && (
            <div className="text-orange-600 dark:text-orange-400 font-medium">
              🔄 Update ready - comprehensive fixes included
            </div>
          )}
          {debugInfo.initError && (
            <div className="text-red-600 dark:text-red-400 font-medium">
              ⚠️ Init Error: {debugInfo.initError}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
