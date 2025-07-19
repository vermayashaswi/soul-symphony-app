
import React, { useState } from 'react';
import { Bell, BellOff, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useNotificationSettings } from '@/hooks/use-notification-settings';

interface NotificationCenterProps {
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { settings, isLoading } = useNotificationSettings();

  const getIcon = () => {
    if (settings.enabled && settings.permissionState === 'granted') {
      return <Bell className="h-5 w-5" />;
    }
    return <BellOff className="h-5 w-5" />;
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
            {/* Status */}
            <div className="text-sm text-muted-foreground">
              {settings.enabled && settings.permissionState === 'granted' ? (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                  <TranslatableText text="Journal reminders are active" />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-gray-400 rounded-full" />
                  <TranslatableText text="Journal reminders are off" />
                </div>
              )}
            </div>

            {/* Settings Button */}
            <Button
              onClick={() => {
                setIsOpen(false);
                if (window.location.pathname !== '/app/settings') {
                  window.location.href = '/app/settings';
                }
              }}
              variant="outline"
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              <TranslatableText text="Notification Settings" />
            </Button>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};
