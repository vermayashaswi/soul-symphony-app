
import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Settings, X, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { enhancedNotificationService, NotificationPermissionState } from '@/services/enhancedNotificationService';
import { toast } from 'sonner';

interface NotificationCenterProps {
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionState>('default');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationTimes, setNotificationTimes] = useState<string[]>([]);

  useEffect(() => {
    const initializeNotificationCenter = async () => {
      try {
        // Check initial permission status
        const currentPermission = await enhancedNotificationService.checkPermissionStatus();
        console.log('[NotificationCenter] Current permission state:', currentPermission);
        setPermissionStatus(currentPermission);
        
        // Load stored notification settings
        const enabled = localStorage.getItem('notification_enabled') === 'true';
        const times = localStorage.getItem('notification_times');
        
        setNotificationsEnabled(enabled && currentPermission === 'granted');
        
        if (times) {
          try {
            const parsedTimes = JSON.parse(times);
            if (Array.isArray(parsedTimes)) {
              setNotificationTimes(parsedTimes);
            }
          } catch (e) {
            console.error('Error parsing notification times', e);
          }
        }
      } catch (error) {
        console.error('[NotificationCenter] Error initializing:', error);
        setPermissionStatus('unsupported');
      }
    };

    initializeNotificationCenter();
    
    // Check permission periodically for changes
    const interval = setInterval(async () => {
      try {
        const currentPermission = await enhancedNotificationService.checkPermissionStatus();
        setPermissionStatus(currentPermission);
      } catch (error) {
        console.error('[NotificationCenter] Error checking permission:', error);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const handleRequestPermission = async () => {
    try {
      console.log('[NotificationCenter] Requesting permission via enhanced service');
      const result = await enhancedNotificationService.requestPermissions();
      console.log('[NotificationCenter] Permission result:', result);
      
      setPermissionStatus(result.state);
      
      if (result.granted) {
        setNotificationsEnabled(true);
        localStorage.setItem('notification_enabled', 'true');
        
        toast.success(
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>
              <TranslatableText text="Notification permission granted!" forceTranslate={true} />
              {result.plugin && (
                <div className="text-xs text-muted-foreground mt-1">
                  Using {result.plugin}
                </div>
              )}
            </span>
          </div>
        );
      } else {
        let errorMessage = "Notification permission denied";
        if (result.error) {
          errorMessage += `: ${result.error}`;
        }
        
        toast.error(
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span>
              <TranslatableText text={errorMessage} forceTranslate={true} />
            </span>
          </div>
        );
      }
    } catch (error) {
      console.error('[NotificationCenter] Error requesting permission:', error);
      toast.error(<TranslatableText text="Failed to request notification permission" forceTranslate={true} />);
    }
  };

  const handleTestNotification = async () => {
    try {
      console.log('[NotificationCenter] Testing notification...');
      const success = await enhancedNotificationService.testNotification();
      
      if (success) {
        toast.success(<TranslatableText text="Test notification sent!" forceTranslate={true} />);
      } else {
        toast.error(<TranslatableText text="Failed to send test notification" forceTranslate={true} />);
      }
    } catch (error) {
      console.error('[NotificationCenter] Error testing notification:', error);
      toast.error(<TranslatableText text="Error testing notification" forceTranslate={true} />);
    }
  };

  const getPermissionBadge = () => {
    switch (permissionStatus) {
      case 'granted':
        return <Badge variant="default" className="bg-green-500"><TranslatableText text="Enabled" /></Badge>;
      case 'denied':
        return <Badge variant="destructive"><TranslatableText text="Blocked" /></Badge>;
      case 'unsupported':
        return <Badge variant="secondary"><TranslatableText text="Unsupported" /></Badge>;
      default:
        return <Badge variant="secondary"><TranslatableText text="Not Set" /></Badge>;
    }
  };

  const getIcon = () => {
    if (notificationsEnabled && permissionStatus === 'granted') {
      return <Bell className="h-5 w-5" />;
    }
    return <BellOff className="h-5 w-5" />;
  };

  const getPermissionStatusIcon = () => {
    switch (permissionStatus) {
      case 'granted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'denied':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'unsupported':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={className}>
          {getIcon()}
          {notificationsEnabled && permissionStatus === 'granted' && (
            <div className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <TranslatableText text="Notifications" />
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
            {/* Permission Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  <TranslatableText text="Permission Status" />
                </span>
                <div className="flex items-center gap-2">
                  {getPermissionStatusIcon()}
                  {getPermissionBadge()}
                </div>
              </div>
              
              {permissionStatus !== 'granted' && permissionStatus !== 'unsupported' && (
                <Button
                  onClick={handleRequestPermission}
                  size="sm"
                  className="w-full"
                  variant={permissionStatus === 'denied' ? 'outline' : 'default'}
                >
                  {permissionStatus === 'denied' ? (
                    <TranslatableText text="Enable in Device Settings" />
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
                {notificationsEnabled && permissionStatus === 'granted' ? (
                  <>
                    <TranslatableText text="Enabled for:" /> {notificationTimes.length > 0 ? notificationTimes.join(', ') : 'Not configured'}
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
                <TranslatableText text="Test Notification" />
              </Button>
              
              <Button
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to settings if needed
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

            {/* Browser/Device Instructions */}
            {permissionStatus === 'denied' && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <TranslatableText text="To enable notifications, go to your device settings and allow notifications for this app, then refresh the page." />
                </p>
              </div>
            )}
            
            {permissionStatus === 'unsupported' && (
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <TranslatableText text="Notifications are not supported on this device or browser." />
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};
