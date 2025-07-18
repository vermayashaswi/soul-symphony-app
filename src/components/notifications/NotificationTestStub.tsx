
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { NotificationStatus } from './NotificationStatusStub';
import { TranslatableText } from '@/components/translation/TranslatableText';

export const NotificationTest: React.FC = () => {
  const handleTestClick = () => {
    alert('Notifications are currently disabled in this app version.');
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
          <Button 
            onClick={handleTestClick}
            variant="outline"
            className="w-full"
            disabled
          >
            <TranslatableText text="Notifications Disabled" />
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground">
          <TranslatableText text="Permission: unsupported" />
        </div>
      </CardContent>
    </Card>
  );
};
