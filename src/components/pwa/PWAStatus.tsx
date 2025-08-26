
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Wifi, 
  WifiOff, 
  Bell, 
  BellOff, 
  Download, 
  Smartphone,
  Check,
  X,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { serviceWorkerManager, isPWA } from '@/utils/serviceWorker';
import { nativeNotificationService } from '@/services/nativeNotificationService';
import { periodicSyncService } from '@/services/periodicSyncService';
import { backgroundSyncService } from '@/services/backgroundSyncService';
import { toast } from 'sonner';

interface PWAStatusProps {
  className?: string;
  compact?: boolean;
}

interface PWAFeatureStatus {
  serviceWorker: boolean;
  offlineSupport: boolean;
  backgroundSync: boolean;
  periodicSync: boolean;
  pushNotifications: boolean;
  installable: boolean;
}

const PWAStatus: React.FC<PWAStatusProps> = ({ className, compact = false }) => {
  const [status, setStatus] = useState<PWAFeatureStatus>({
    serviceWorker: false,
    offlineSupport: false,
    backgroundSync: false,
    periodicSync: false,
    pushNotifications: false,
    installable: false
  });
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    checkPWAStatus();
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check pending sync count periodically
    const syncCheckInterval = setInterval(checkPendingSyncCount, 30000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncCheckInterval);
    };
  }, []);

  const checkPWAStatus = async () => {
    const newStatus: PWAFeatureStatus = {
      serviceWorker: serviceWorkerManager.isServiceWorkerRegistered(),
      offlineSupport: 'caches' in window,
      backgroundSync: serviceWorkerManager.getCapabilities().backgroundSync,
      periodicSync: periodicSyncService.isSupported(),
      pushNotifications: false, // Disabled - using native notifications
      installable: isPWA() || 'BeforeInstallPromptEvent' in window
    };
    
    setStatus(newStatus);
    
    // Check push permission
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
    
    await checkPendingSyncCount();
  };

  const checkPendingSyncCount = async () => {
    try {
      const count = await backgroundSyncService.getPendingCount();
      setPendingSyncCount(count);
    } catch (error) {
      console.error('Error checking pending sync count:', error);
    }
  };

  const handleEnablePushNotifications = async () => {
    try {
      const result = await nativeNotificationService.requestPermissions();
      if (result.granted) {
        setPushPermission('granted');
        toast.success('Notifications enabled!');
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      toast.error('Failed to enable notifications');
    }
  };

  const handleManualSync = async () => {
    try {
      await backgroundSyncService.manualSync();
      await checkPendingSyncCount();
    } catch (error) {
      console.error('Manual sync failed:', error);
      toast.error('Sync failed');
    }
  };

  const getStatusIcon = (enabled: boolean) => {
    return enabled ? (
      <Check className="w-3 h-3 text-green-600" />
    ) : (
      <X className="w-3 h-3 text-red-600" />
    );
  };

  const getConnectionBadge = () => {
    if (isOnline) {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <Wifi className="w-3 h-3" />
          Online
        </Badge>
      );
    }
    
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <WifiOff className="w-3 h-3" />
        Offline
      </Badge>
    );
  };

  const getPushNotificationBadge = () => {
    if (pushPermission === 'granted') {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <Bell className="w-3 h-3" />
          Enabled
        </Badge>
      );
    }
    
    if (pushPermission === 'denied') {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <BellOff className="w-3 h-3" />
          Blocked
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Not Set
      </Badge>
    );
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {getConnectionBadge()}
        {pendingSyncCount > 0 && (
          <Badge variant="outline" className="flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            {pendingSyncCount} pending
          </Badge>
        )}
        {getPushNotificationBadge()}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          PWA Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Connection</span>
          {getConnectionBadge()}
        </div>

        {/* PWA Features */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">PWA Features</h4>
          
          <div className="flex items-center justify-between text-sm">
            <span>Service Worker</span>
            {getStatusIcon(status.serviceWorker)}
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span>Offline Support</span>
            {getStatusIcon(status.offlineSupport)}
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span>Background Sync</span>
            {getStatusIcon(status.backgroundSync)}
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span>Periodic Sync</span>
            {getStatusIcon(status.periodicSync)}
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span>Push Notifications</span>
            {getStatusIcon(status.pushNotifications)}
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span>Installable</span>
            {getStatusIcon(status.installable)}
          </div>
        </div>

        {/* Sync Status */}
        {pendingSyncCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Pending Sync</span>
              <Badge variant="outline">
                {pendingSyncCount} items
              </Badge>
            </div>
            <Button
              onClick={handleManualSync}
              size="sm"
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Now
            </Button>
          </div>
        )}

        {/* Push Notifications */}
        {status.pushNotifications && pushPermission !== 'granted' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Notifications</span>
              {getPushNotificationBadge()}
            </div>
            {pushPermission === 'default' && (
              <Button
                onClick={handleEnablePushNotifications}
                size="sm"
                variant="outline"
                className="w-full"
              >
                <Bell className="w-4 h-4 mr-2" />
                Enable Notifications
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PWAStatus;
