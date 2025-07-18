
import React, { useState } from 'react';
import { BellOff, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface NotificationCenterProps {
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleTestNotification = () => {
    alert('Notifications are currently disabled in this app version.');
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={className}>
          <BellOff className="h-5 w-5" />
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
                <Badge variant="secondary">
                  <TranslatableText text="Disabled" />
                </Badge>
              </div>
            </div>

            {/* Current Settings */}
            <div className="space-y-2">
              <span className="text-sm font-medium">
                <TranslatableText text="Current Settings" />
              </span>
              <div className="text-sm text-muted-foreground">
                <TranslatableText text="Notifications are disabled in this version" />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button
                onClick={handleTestNotification}
                size="sm"
                variant="outline"
                className="w-full"
                disabled
              >
                <TranslatableText text="Test Notification (Disabled)" />
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
                <TranslatableText text="Settings" />
              </Button>
            </div>

            {/* Info */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                <TranslatableText text="Notifications are currently disabled in this app version for improved stability." />
              </p>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};
