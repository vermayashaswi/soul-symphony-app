
import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Settings, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { getNotificationSettings, testNotification, requestNotificationPermission } from '@/services/notificationService';
import { webToNativeNotificationService } from '@/services/webToNativeNotificationService';
import { useMobileNotifications } from '@/hooks/use-mobile-notifications';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

interface NotificationCenterProps {
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState(getNotificationSettings());
  const isMobile = useIsMobile();
  
  // Use mobile notifications hook for enhanced mobile support
  const {
    permission: mobilePermission,
    isSupported: mobileSupported,
    isWebToNative,
    isGranted: mobileGranted,
    isDenied: mobileDenied,
    requestPermission: requestMobilePermission,
    showNotification: showMobileNotification,
    vibrate
  } = useMobileNotifications();

  // Fallback to web notifications for non-mobile
  const [webPermissionStatus, setWebPermissionStatus] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Check web notification permission for non-mobile devices
    if (!isMobile && 'Notification' in window) {
      setWebPermissionStatus(Notification.permission);
      
      const interval = setInterval(() => {
        setWebPermissionStatus(Notification.permission);
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [isMobile]);

  const permissionStatus = isMobile ? mobilePermission : webPermissionStatus;
  const isGranted = isMobile ? mobileGranted : webPermissionStatus === 'granted';
  const isDenied = isMobile ? mobileDenied : webPermissionStatus === 'denied';

  const handleRequestPermission = async () => {
    console.log('[NotificationCenter] Requesting permission, isMobile:', isMobile, 'isWebToNative:', isWebToNative);
    
    let granted = false;
    
    if (isMobile || isWebToNative) {
      // Use mobile notification service
      granted = await requestMobilePermission();
      if (granted && isMobile) {
        vibrate([100, 50, 100]); // Success vibration
      }
    } else {
      // Use web notification service
      granted = await requestNotificationPermission();
    }
    
    if (granted) {
      toast.success(<TranslatableText text="Notification permission granted!" forceTranslate={true} />);
    } else {
      toast.error(<TranslatableText text="Notification permission denied" forceTranslate={true} />);
    }
  };

  const handleTestNotification = () => {
    if (isGranted) {
      if (isMobile || isWebToNative) {
        // Use mobile notification service
        showMobileNotification(
          'Test Notification 📱',
          'This is a test from your voice journaling app!',
          { tag: 'test-mobile-notification' }
        );
        if (isMobile) {
          vibrate(200); // Test vibration
        }
      } else {
        // Use web notification service
        testNotification();
      }
      toast.success(<TranslatableText text="Test notification sent!" forceTranslate={true} />);
    } else {
      toast.error(<TranslatableText text="Please grant notification permission first" forceTranslate={true} />);
    }
  };

  const getPermissionBadge = () => {
    switch (permissionStatus) {
      case 'granted':
        return <Badge variant="default" className="bg-green-500"><TranslatableText text="Enabled" /></Badge>;
      case 'denied':
        return <Badge variant="destructive"><TranslatableText text="Blocked" /></Badge>;
      default:
        return <Badge variant="secondary"><TranslatableText text="Not Set" /></Badge>;
    }
  };

  const getIcon = () => {
    if (notificationSettings.enabled && isGranted) {
      return <Bell className="h-5 w-5" />;
    }
    return <BellOff className="h-5 w-5" />;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={className}>
          {getIcon()}
          {notificationSettings.enabled && isGranted && (
            <div className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <TranslatableText text={isMobile || isWebToNative ? "Mobile Notifications" : "Notifications"} />
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
            {/* Environment indicator */}
            {isWebToNative && (
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <TranslatableText text="Running in native mobile app" />
                </p>
              </div>
            )}
            
            {/* Permission Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  <TranslatableText text="Permission Status" />
                </span>
                {getPermissionBadge()}
              </div>
              
              {!isGranted && (
                <Button
                  onClick={handleRequestPermission}
                  size="sm"
                  className="w-full"
                  variant={isDenied ? 'outline' : 'default'}
                >
                  {isDenied ? (
                    <TranslatableText text={isMobile || isWebToNative ? "Enable in App Settings" : "Enable in Browser Settings"} />
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
                disabled={!isGranted}
              >
                <TranslatableText text={isMobile || isWebToNative ? "Test Mobile Notification" : "Test Notification"} />
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

            {/* Instructions */}
            {isDenied && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  {isMobile || isWebToNative ? (
                    <TranslatableText text="To enable notifications, go to your device's app settings and allow notifications for this app." />
                  ) : (
                    <TranslatableText text="To enable notifications, click the lock icon in your browser's address bar and allow notifications for this site." />
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};
