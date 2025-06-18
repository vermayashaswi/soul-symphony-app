
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Wifi, 
  WifiOff, 
  Download, 
  Trash2, 
  RefreshCw, 
  Smartphone,
  Globe,
  Database,
  Clock
} from 'lucide-react';
import { versionService } from '@/services/versionService';
import { serviceWorkerManager } from '@/utils/serviceWorker';
import { toast } from 'sonner';

interface PWAStatus {
  isOnline: boolean;
  isInstalled: boolean;
  hasServiceWorker: boolean;
  cacheSize: string;
  lastSync: string;
  pendingSync: number;
}

const EnhancedPWAStatus: React.FC = () => {
  const [status, setStatus] = useState<PWAStatus>({
    isOnline: navigator.onLine,
    isInstalled: false,
    hasServiceWorker: false,
    cacheSize: '0 MB',
    lastSync: 'Never',
    pendingSync: 0
  });
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    updateStatus();
    
    const handleOnline = () => updateStatus();
    const handleOffline = () => updateStatus();
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Update status every 30 seconds
    const interval = setInterval(updateStatus, 30000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const updateStatus = async () => {
    try {
      const cacheSize = await versionService.getCacheSize();
      const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
      const hasServiceWorker = serviceWorkerManager.isServiceWorkerRegistered();
      
      // Check pending sync items
      const pendingSync = await getPendingSyncCount();
      
      setStatus({
        isOnline: navigator.onLine,
        isInstalled,
        hasServiceWorker,
        cacheSize,
        lastSync: localStorage.getItem('lastSync') || 'Never',
        pendingSync
      });
    } catch (error) {
      console.error('[EnhancedPWAStatus] Error updating status:', error);
    }
  };

  const getPendingSyncCount = async (): Promise<number> => {
    try {
      return new Promise((resolve) => {
        const request = indexedDB.open('SouloOfflineDB', 1);
        
        request.onsuccess = () => {
          const db = request.result;
          if (db.objectStoreNames.contains('journalEntries')) {
            const transaction = db.transaction(['journalEntries'], 'readonly');
            const store = transaction.objectStore('journalEntries');
            const index = store.index('offline');
            
            const countRequest = index.count(IDBKeyRange.only(true));
            countRequest.onsuccess = () => resolve(countRequest.result);
            countRequest.onerror = () => resolve(0);
          } else {
            resolve(0);
          }
        };
        
        request.onerror = () => resolve(0);
      });
    } catch (error) {
      return 0;
    }
  };

  const handleClearCache = async () => {
    setIsClearing(true);
    
    try {
      await versionService.clearCache();
      toast.success('Cache cleared successfully');
      await updateStatus();
    } catch (error) {
      toast.error('Failed to clear cache');
      console.error('[EnhancedPWAStatus] Error clearing cache:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const handleForceSync = async () => {
    try {
      await serviceWorkerManager.requestBackgroundSync('journal-entry-sync');
      toast.success('Sync requested');
      setTimeout(updateStatus, 2000);
    } catch (error) {
      toast.error('Sync request failed');
      console.error('[EnhancedPWAStatus] Error requesting sync:', error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Smartphone className="w-5 h-5" />
          <span>PWA Status</span>
        </CardTitle>
        <CardDescription>
          Progressive Web App connectivity and cache status
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {status.isOnline ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className="text-sm font-medium">Connection</span>
          </div>
          <Badge variant={status.isOnline ? "default" : "destructive"}>
            {status.isOnline ? "Online" : "Offline"}
          </Badge>
        </div>

        {/* Installation Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Installation</span>
          </div>
          <Badge variant={status.isInstalled ? "default" : "secondary"}>
            {status.isInstalled ? "Installed" : "Browser"}
          </Badge>
        </div>

        {/* Service Worker Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4" />
            <span className="text-sm font-medium">Service Worker</span>
          </div>
          <Badge variant={status.hasServiceWorker ? "default" : "destructive"}>
            {status.hasServiceWorker ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Cache Size */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4" />
            <span className="text-sm font-medium">Cache Size</span>
          </div>
          <span className="text-sm text-muted-foreground">{status.cacheSize}</span>
        </div>

        {/* Pending Sync */}
        {status.pendingSync > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium">Pending Sync</span>
            </div>
            <Badge variant="outline" className="text-orange-600">
              {status.pendingSync} items
            </Badge>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCache}
            disabled={isClearing}
            className="flex-1"
          >
            {isClearing ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Clear Cache
          </Button>
          
          {status.pendingSync > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleForceSync}
              className="flex-1"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Force Sync
            </Button>
          )}
        </div>

        {/* Last Sync Info */}
        {status.lastSync !== 'Never' && (
          <div className="text-xs text-muted-foreground pt-2">
            Last sync: {status.lastSync}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EnhancedPWAStatus;
