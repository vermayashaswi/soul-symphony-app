
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Smartphone, RefreshCw, CheckCircle, AlertTriangle, Wifi } from 'lucide-react';
import { nativeAppService } from '@/services/nativeAppService';
import { versionService } from '@/services/versionService';

export const PWABuilderTestIndicator: React.FC = () => {
  const [appInfo, setAppInfo] = useState(nativeAppService.getAppInfo());
  const [version, setVersion] = useState<string>('Unknown');
  const [updateStatus, setUpdateStatus] = useState<'current' | 'available' | 'updating'>('current');
  const [lastUpdate, setLastUpdate] = useState<string>('Never');
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const addTestLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(`[PWA BUILDER TEST] ${logEntry}`);
    setTestLogs(prev => [...prev.slice(-4), logEntry]);
  };

  useEffect(() => {
    const initializeTest = () => {
      const currentVersion = versionService.getCurrentVersion();
      setVersion(currentVersion.version);
      
      if (appInfo.isPWABuilder) {
        addTestLog(`PWA BUILDER: Detected PWA Builder app v${currentVersion.version}`);
        addTestLog(`PWA BUILDER: Platform: ${appInfo.platform}`);
        addTestLog(`PWA BUILDER: Build timestamp: ${appInfo.buildTimestamp}`);
      } else if (appInfo.isNativeApp) {
        addTestLog(`NATIVE: Detected native app (non-PWA Builder)`);
      } else {
        addTestLog(`WEB: Regular web browser detected`);
      }
    };

    initializeTest();
  }, [appInfo]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addTestLog('PWA BUILDER: Connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      addTestLog('PWA BUILDER: Connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      addTestLog('PWA BUILDER: Service worker not supported');
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      addTestLog(`PWA BUILDER: SW message: ${event.data.type}`);
      
      switch (event.data.type) {
        case 'SW_ACTIVATED':
          setUpdateStatus('current');
          setLastUpdate(new Date().toLocaleTimeString());
          addTestLog(`PWA BUILDER: SW activated v${event.data.version}`);
          break;
        case 'UPDATE_AVAILABLE':
          setUpdateStatus('available');
          addTestLog('PWA BUILDER: Update available');
          break;
        case 'FORCE_REFRESH':
          setUpdateStatus('updating');
          addTestLog('PWA BUILDER: Force refresh requested');
          break;
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  const getStatusIcon = () => {
    if (!isOnline) {
      return <Wifi className="h-4 w-4 text-red-500" />;
    }
    
    switch (updateStatus) {
      case 'available':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'updating':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getStatusText = () => {
    if (!isOnline) {
      return 'Offline';
    }
    
    switch (updateStatus) {
      case 'available':
        return 'Update Available';
      case 'updating':
        return 'Updating...';
      default:
        return 'Up to Date';
    }
  };

  const getAppTypeColor = () => {
    if (appInfo.isPWABuilder) return 'bg-blue-500';
    if (appInfo.isNativeApp) return 'bg-purple-500';
    return 'bg-gray-500';
  };

  const getAppTypeText = () => {
    if (appInfo.isPWABuilder) return 'PWA Builder';
    if (appInfo.isNativeApp) return 'Native App';
    return 'Web Browser';
  };

  const triggerManualUpdate = () => {
    addTestLog('PWA BUILDER: Manual update triggered');
    versionService.triggerManualUpdate();
  };

  return (
    <Card className="fixed top-4 right-4 z-50 w-80 bg-background/95 backdrop-blur-sm border-2 border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Smartphone className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">PWA Builder Test</span>
          <Badge variant="outline" className="text-xs">v{version}</Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">App Type:</span>
            <Badge className={`text-xs text-white ${getAppTypeColor()}`}>
              {getAppTypeText()}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Status:</span>
            <div className="flex items-center gap-1">
              {getStatusIcon()}
              <span className="text-xs font-medium">{getStatusText()}</span>
            </div>
          </div>
          
          {appInfo.isPWABuilder && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Platform:</span>
              <span className="text-xs capitalize">{appInfo.platform}</span>
            </div>
          )}
          
          {lastUpdate !== 'Never' && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Last Update:</span>
              <span className="text-xs">{lastUpdate}</span>
            </div>
          )}
          
          <div className="mt-3 pt-2 border-t">
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs text-muted-foreground">Test Logs:</div>
              <button
                onClick={triggerManualUpdate}
                className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/80"
              >
                Check Update
              </button>
            </div>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {testLogs.map((log, index) => (
                <div key={index} className="text-xs font-mono bg-muted/50 p-1 rounded">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
