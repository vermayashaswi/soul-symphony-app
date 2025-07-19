
import React, { useState } from 'react';
import { Bell, BellOff, Settings, X, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useNotificationSettings } from '@/hooks/use-notification-settings';
import { enhancedNotificationService } from '@/services/enhancedNotificationService';
import { toast } from 'sonner';

interface NotificationCenterProps {
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { settings, isLoading, isRequesting, toggleNotifications, refreshPermissionStatus } = useNotificationSettings();

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

  const handleToggleNotifications = async () => {
    if (isRequesting) return;
    
    console.log('[NotificationCenter] User toggling notifications:', !settings.enabled);
    const success = await toggleNotifications(!settings.enabled);
    
    if (success) {
      // Refresh permission status after successful toggle
      setTimeout(() => {
        refreshPermissionStatus();
      }, 1000);
    }
  };

  const getPermissionBadge = () => {
    switch (settings.permissionState) {
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
    if (settings.enabled && settings.permissionState === 'granted') {
      return <Bell className="h-5 w-5" />;
    }
    return <BellOff className="h-5 w-5" />;
  };

  const getPermissionStatusIcon = () => {
    switch (settings.permissionState) {
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

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" className={className} disabled>
        <BellOff className="h-5 w-5 animate-pulse" />
      </Button>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={className}>
          {getIcon()}
          {settings.enabled && settings.permissionState === 'granted' && (
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
              
              {/* Toggle Button */}
              <Button
                onClick={handleToggleNotifications}
                size="sm"
                className="w-full"
                variant={settings.enabled ? 'outline' : 'default'}
                disabled={isRequesting || settings.permissionState === 'unsupported'}
              >
                {isRequesting ? (
                  <TranslatableText text="Processing..." />
                ) : settings.enabled ? (
                  <TranslatableText text="Disable Notifications" />
                ) : settings.permissionState === 'denied' ? (
                  <TranslatableText text="Enable in Device Settings" />
                ) : (
                  <TranslatableText text="Enable Notifications" />
                )}
              </Button>
            </div>

            {/* Current Settings */}
            <div className="space-y-2">
              <span className="text-sm font-medium">
                <TranslatableText text="Current Settings" />
              </span>
              <div className="text-sm text-muted-foreground">
                {settings.enabled && settings.permissionState === 'granted' ? (
                  <>
                    <TranslatableText text="Enabled for:" /> {settings.times.length > 0 ? settings.times.join(', ') : 'Not configured'}
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
                disabled={settings.permissionState !== 'granted'}
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
            {settings.permissionState === 'denied' && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <TranslatableText text="To enable notifications, go to your device settings and allow notifications for this app, then refresh the page." />
                </p>
              </div>
            )}
            
            {settings.permissionState === 'unsupported' && (
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
