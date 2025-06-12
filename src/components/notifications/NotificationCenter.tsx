
import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Settings, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { getNotificationSettings, testNotification, requestNotificationPermission } from '@/services/notificationService';
import { toast } from 'sonner';

interface NotificationCenterProps {
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState(getNotificationSettings());
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Check initial permission status
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
    
    // Listen for permission changes
    const checkPermission = () => {
      if ('Notification' in window) {
        setPermissionStatus(Notification.permission);
      }
    };
    
    // Check permission periodically
    const interval = setInterval(checkPermission, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      toast.success(<TranslatableText text="Notification permission granted!" forceTranslate={true} />);
      setPermissionStatus('granted');
    } else {
      toast.error(<TranslatableText text="Notification permission denied" forceTranslate={true} />);
    }
  };

  const handleTestNotification = () => {
    if (permissionStatus === 'granted') {
      testNotification();
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
    if (notificationSettings.enabled && permissionStatus === 'granted') {
      return <Bell className="h-5 w-5" />;
    }
    return <BellOff className="h-5 w-5" />;
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
                    <TranslatableText text="Enable in Browser Settings" />
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

            {/* Browser Instructions */}
            {permissionStatus === 'denied' && (
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
