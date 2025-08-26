
import React from 'react';
import { Bell, BellOff, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useNotificationPermissionSimple } from '@/hooks/use-notification-permission-simple';
import { getNotificationSettings } from '@/services/unifiedNotificationService';

interface NotificationStatusProps {
  className?: string;
  showText?: boolean;
}

export const NotificationStatus: React.FC<NotificationStatusProps> = ({ 
  className, 
  showText = false 
}) => {
  const { 
    permission, 
    isGranted, 
    isDenied, 
    isDefault,
    initializationComplete,
    requestPermission 
  } = useNotificationPermissionSimple();
  const settings = getNotificationSettings();

  const getStatusInfo = () => {
    if (!initializationComplete) {
      return {
        icon: Loader2,
        text: 'Checking...',
        variant: 'secondary' as const,
        color: 'text-muted-foreground animate-spin'
      };
    }

    if (!settings.enabled) {
      return {
        icon: BellOff,
        text: 'Disabled',
        variant: 'secondary' as const,
        color: 'text-muted-foreground'
      };
    }

    if (permission === 'unsupported') {
      return {
        icon: AlertCircle,
        text: 'Not Supported',
        variant: 'destructive' as const,
        color: 'text-destructive'
      };
    }

    if (isDenied) {
      return {
        icon: AlertCircle,
        text: 'Blocked',
        variant: 'destructive' as const,
        color: 'text-destructive'
      };
    }

    if (isGranted) {
      return {
        icon: Bell,
        text: 'Enabled',
        variant: 'default' as const,
        color: 'text-green-600'
      };
    }

    return {
      icon: AlertCircle,
      text: 'Permission Needed',
      variant: 'outline' as const,
      color: 'text-yellow-600'
    };
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  if (showText) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Icon className={`h-4 w-4 ${statusInfo.color}`} />
        <span className="text-sm">
          <TranslatableText text={statusInfo.text} />
        </span>
        {isDefault && initializationComplete && (
          <Button
            size="sm"
            variant="outline"
            onClick={requestPermission}
            className="ml-2"
            disabled={!initializationComplete}
          >
            <TranslatableText text="Enable" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Badge variant={statusInfo.variant} className={className}>
      <Icon className="h-3 w-3 mr-1" />
      <TranslatableText text={statusInfo.text} />
    </Badge>
  );
};
