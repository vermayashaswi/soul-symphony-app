
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Rocket, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { versionService } from '@/services/versionService';

export const PWATestIndicator: React.FC = () => {
  const [version, setVersion] = useState<string>('Unknown');
  const [updateStatus, setUpdateStatus] = useState<'current' | 'available' | 'updating'>('current');
  const [lastUpdate, setLastUpdate] = useState<string>('Never');
  const [testLogs, setTestLogs] = useState<string[]>([]);

  const addTestLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(`[PWA TEST] ${logEntry}`);
    setTestLogs(prev => [...prev.slice(-4), logEntry]); // Keep last 5 logs
  };

  useEffect(() => {
    const initializeTest = () => {
      const currentVersion = versionService.getCurrentVersion();
      setVersion(currentVersion.version);
      addTestLog(`TEST PLAN: Component initialized with version ${currentVersion.version}`);
      addTestLog(`TEST PLAN: Features: ${currentVersion.features.slice(0, 2).join(', ')}`);
    };

    initializeTest();
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      addTestLog('TEST PLAN: Service worker not supported');
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      addTestLog(`TEST PLAN: SW message received: ${event.data.type}`);
      
      if (event.data.testPlan) {
        addTestLog('TEST PLAN: Message confirmed from test service worker');
      }
      
      switch (event.data.type) {
        case 'SW_ACTIVATED':
          setUpdateStatus('current');
          setLastUpdate(new Date().toLocaleTimeString());
          addTestLog(`TEST PLAN: SW activated with version ${event.data.version}`);
          break;
        case 'UPDATE_AVAILABLE':
          setUpdateStatus('available');
          addTestLog('TEST PLAN: Update available detected');
          break;
        case 'FORCE_REFRESH':
          setUpdateStatus('updating');
          addTestLog('TEST PLAN: Force refresh requested');
          break;
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  const getStatusIcon = () => {
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
    switch (updateStatus) {
      case 'available':
        return 'Update Available';
      case 'updating':
        return 'Updating...';
      default:
        return 'Up to Date';
    }
  };

  return (
    <Card className="fixed top-4 right-4 z-50 w-80 bg-background/95 backdrop-blur-sm border-2 border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Rocket className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">PWA Test Plan</span>
          <Badge variant="outline" className="text-xs">v{version}</Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Status:</span>
            <div className="flex items-center gap-1">
              {getStatusIcon()}
              <span className="text-xs font-medium">{getStatusText()}</span>
            </div>
          </div>
          
          {lastUpdate !== 'Never' && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Last Update:</span>
              <span className="text-xs">{lastUpdate}</span>
            </div>
          )}
          
          <div className="mt-3 pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-1">Test Logs:</div>
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
