
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useNotificationPermissionSimple } from '@/hooks/use-notification-permission-simple';
import { NotificationStatus } from './NotificationStatus';
import { TranslatableText } from '@/components/translation/TranslatableText';

export const NotificationTest: React.FC = () => {
  const { 
    permission, 
    isGranted, 
    requestPermission,
    initializationComplete 
  } = useNotificationPermissionSimple();

  const sendTestNotification = () => {
    if (!isGranted) {
      console.log('Permission not granted, cannot send test notification');
      return;
    }

    if ('Notification' in window) {
      new Notification('SOULo Test', {
        body: 'This is a test notification from SOULo app!',
        icon: '/favicon.ico'
      });
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          <TranslatableText text="Notification Test" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            <TranslatableText text="Status:" />
          </span>
          <NotificationStatus showText />
        </div>
        
        <div className="flex flex-col gap-2">
          {!isGranted && initializationComplete && (
            <Button 
              onClick={requestPermission}
              variant="outline"
              className="w-full"
            >
              <TranslatableText text="Request Permission" />
            </Button>
          )}
          
          {isGranted && (
            <Button 
              onClick={sendTestNotification}
              className="w-full"
            >
              <TranslatableText text="Send Test Notification" />
            </Button>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground">
          <TranslatableText text={`Permission: ${permission}`} />
        </div>
      </CardContent>
    </Card>
  );
};
