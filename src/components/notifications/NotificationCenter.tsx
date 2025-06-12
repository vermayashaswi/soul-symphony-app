
import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Settings, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useMobileNotifications } from '@/hooks/use-mobile-notifications';
import { useNotificationBridge } from './NotificationBridge';
import { toast } from 'sonner';

interface NotificationCenterProps {
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    settings, 
    hasPermission, 
    canRequestPermission, 
    enableNotifications, 
    disableNotifications, 
    testNotification,
    isLoading 
  } = useMobileNotifications();
  
  const { deviceInfo, permissionStatus } = useNotificationBridge();

  const handleToggleChange = async (checked: boolean) => {
    if (checked) {
      // User wants to enable notifications
      const success = await enableNotifications(settings.times.length > 0 ? settings.times : ['evening']);
      if (!success) {
        // Permission was denied or failed, ensure switch stays off
        // The switch state is controlled by settings.enabled, which won't change if permission failed
        return;
      }
    } else {
      // User wants to disable notifications
      await disableNotifications();
    }
  };

  const handleRequestPermission = async () => {
    const success = await enableNotifications(['evening']);
    if (success) {
      toast.success(<TranslatableText text="Notification permission granted!" forceTranslate={true} />);
    }
  };

  const handleTestNotification = () => {
    if (hasPermission) {
      testNotification();
    } else {
      toast.error(<TranslatableText text="Please grant notification permission first" forceTranslate={true} />);
    }
  };

  const getPermissionBadge = () => {
    if (isLoading) {
      return <Badge variant="secondary"><TranslatableText text="Loading..." /></Badge>;
    }

    switch (permissionStatus?.status) {
      case 'granted':
        return <Badge variant="default" className="bg-green-500"><TranslatableText text="Enabled" /></Badge>;
      case 'denied':
        return <Badge variant="destructive"><TranslatableText text="Blocked" /></Badge>;
      default:
        return <Badge variant="secondary"><TranslatableText text="Not Set" /></Badge>;
    }
  };

  const getIcon = () => {
    if (settings.enabled && hasPermission) {
      return <Bell className="h-5 w-5" />;
    }
    return <BellOff className="h-5 w-5" />;
  };

  const getEnvironmentInfo = () => {
    if (!deviceInfo) return null;

    return (
      <div className="text-xs text-muted-foreground space-y-1">
        <div>Environment: {deviceInfo.isNative ? 'Native App' : 'Web Browser'}</div>
        <div>Platform: {deviceInfo.platform}</div>
        {deviceInfo.isMobile && <div>Mobile Device Detected</div>}
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={className} disabled={isLoading}>
          {getIcon()}
          {settings.enabled && hasPermission && (
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
              
              {!hasPermission && canRequestPermission && (
                <Button
                  onClick={handleRequestPermission}
                  size="sm"
                  className="w-full"
                  disabled={isLoading}
                  variant={permissionStatus?.status === 'denied' ? 'outline' : 'default'}
                >
                  {permissionStatus?.status === 'denied' ? (
                    <TranslatableText text="Enable in Settings" />
                  ) : (
                    <TranslatableText text="Grant Permission" />
                  )}
                </Button>
              )}
            </div>

            {/* Notification Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  <TranslatableText text="Enable Notifications" />
                </span>
                <Switch 
                  checked={settings.enabled && hasPermission}
                  onCheckedChange={handleToggleChange}
                  disabled={isLoading || (!hasPermission && !canRequestPermission)}
                />
              </div>
              
              <div className="text-sm text-muted-foreground">
                {settings.enabled ? (
                  hasPermission ? (
                    <>
                      <TranslatableText text="Active for:" /> {settings.times.join(', ')}
                    </>
                  ) : (
                    <TranslatableText text="Permission required" />
                  )
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
                disabled={!hasPermission || isLoading}
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

            {/* Environment Info */}
            {getEnvironmentInfo()}

            {/* Browser Instructions */}
            {permissionStatus?.status === 'denied' && !deviceInfo?.isNative && (
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
