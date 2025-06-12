
import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Settings, X, Smartphone, Vibrate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { webToNativeNotificationService } from '@/services/webToNativeNotificationService';
import { getNotificationSettings } from '@/services/notificationService';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileNotificationCenterProps {
  className?: string;
}

export const MobileNotificationCenter: React.FC<MobileNotificationCenterProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState(getNotificationSettings());
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [isWebToNative, setIsWebToNative] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Initialize WebToNative notification service
    setPermissionStatus(webToNativeNotificationService.getPermissionStatus());
    setIsWebToNative(webToNativeNotificationService.isWebToNativeEnvironment());
    
    // Check permission status periodically
    const interval = setInterval(() => {
      setPermissionStatus(webToNativeNotificationService.getPermissionStatus());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const handleRequestPermission = async () => {
    console.log('[MobileNotificationCenter] Requesting permission');
    
    try {
      const granted = await webToNativeNotificationService.requestPermission();
      
      if (granted) {
        toast.success(<TranslatableText text="Notification permission granted!" forceTranslate={true} />);
        setPermissionStatus('granted');
        
        // Add vibration feedback for mobile
        if (isMobile) {
          webToNativeNotificationService.vibrate([100, 50, 100]);
        }
      } else {
        toast.error(<TranslatableText text="Notification permission denied" forceTranslate={true} />);
        setPermissionStatus('denied');
      }
    } catch (error) {
      console.error('[MobileNotificationCenter] Permission request failed:', error);
      toast.error(<TranslatableText text="Failed to request notification permission" forceTranslate={true} />);
    }
  };

  const handleTestNotification = () => {
    if (permissionStatus === 'granted') {
      webToNativeNotificationService.showNotification(
        'Test Notification 📱',
        {
          body: 'This is a test notification from your voice journaling app!',
          icon: '/icons/icon-192x192.png',
          tag: 'test-mobile-notification'
        }
      );
      
      toast.success(<TranslatableText text="Test notification sent!" forceTranslate={true} />);
      
      // Add vibration feedback
      if (isMobile) {
        webToNativeNotificationService.vibrate(200);
      }
    } else {
      toast.error(<TranslatableText text="Please grant notification permission first" forceTranslate={true} />);
    }
  };

  const getPermissionBadge = () => {
    switch (permissionStatus) {
      case 'granted':
        return (
          <Badge variant="default" className="bg-green-500">
            <Smartphone className="h-3 w-3 mr-1" />
            <TranslatableText text="Enabled" />
          </Badge>
        );
      case 'denied':
        return (
          <Badge variant="destructive">
            <X className="h-3 w-3 mr-1" />
            <TranslatableText text="Blocked" />
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Bell className="h-3 w-3 mr-1" />
            <TranslatableText text="Not Set" />
          </Badge>
        );
    }
  };

  const getIcon = () => {
    if (notificationSettings.enabled && permissionStatus === 'granted') {
      return <Bell className="h-5 w-5 text-green-600" />;
    }
    return <BellOff className="h-5 w-5 text-muted-foreground" />;
  };

  const getEnvironmentInfo = () => {
    if (isWebToNative) {
      return (
        <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Smartphone className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            <TranslatableText text="Running in native mobile app" />
          </span>
        </div>
      );
    }
    return null;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={className}>
          {getIcon()}
          {notificationSettings.enabled && permissionStatus === 'granted' && (
            <div className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                <TranslatableText text="Mobile Notifications" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Environment Info */}
            {getEnvironmentInfo()}
            
            {/* Permission Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  <TranslatableText text="Permission Status" />
                </span>
                {getPermissionBadge()}
              </div>
              
              {permissionStatus !== 'granted' && (
                <Button
                  onClick={handleRequestPermission}
                  size="sm"
                  className="w-full"
                  variant={permissionStatus === 'denied' ? 'outline' : 'default'}
                >
                  {permissionStatus === 'denied' ? (
                    <TranslatableText text="Enable in App Settings" />
                  ) : (
                    <TranslatableText text="Grant Permission" />
                  )}
                </Button>
              )}
            </div>

            {/* Current Settings */}
            <div className="space-y-2">
              <span className="text-sm font-medium">
                <TranslatableText text="Current Settings" />
              </span>
              <div className="text-sm text-muted-foreground">
                {notificationSettings.enabled ? (
                  <>
                    <TranslatableText text="Enabled for:" /> {notificationSettings.times.join(', ')}
                  </>
                ) : (
                  <TranslatableText text="Disabled" />
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button
                onClick={handleTestNotification}
                size="sm"
                variant="outline"
                className="w-full"
                disabled={permissionStatus !== 'granted'}
              >
                <Vibrate className="h-4 w-4 mr-2" />
                <TranslatableText text="Test Mobile Notification" />
              </Button>
              
              <Button
                onClick={() => {
                  setIsOpen(false);
                  if (window.location.pathname !== '/app/settings') {
                    window.location.href = '/app/settings';
                  }
                }}
                size="sm"
                variant="outline"
                className="w-full"
              >
                <Settings className="h-4 w-4 mr-2" />
                <TranslatableText text="Notification Settings" />
              </Button>
            </div>

            {/* Mobile Instructions */}
            {permissionStatus === 'denied' && isWebToNative && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  <TranslatableText text="To enable notifications, go to your device's app settings and allow notifications for this app." />
                </p>
              </div>
            )}
            
            {/* Web Instructions */}
            {permissionStatus === 'denied' && !isWebToNative && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <TranslatableText text="To enable notifications, click the lock icon in your browser's address bar and allow notifications for this site." />
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};
