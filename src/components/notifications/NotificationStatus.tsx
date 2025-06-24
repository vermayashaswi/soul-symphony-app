
import React, { useState } from 'react';
import { Bell, BellOff, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { usePermissionManager } from '@/hooks/usePermissionManager';
import { PermissionPrompt } from '@/components/permissions/PermissionPrompt';
import { getNotificationSettings } from '@/services/notificationService';

interface NotificationStatusProps {
  className?: string;
  showText?: boolean;
}

export const NotificationStatus: React.FC<NotificationStatusProps> = ({ 
  className, 
  showText = false 
}) => {
  const { permissions, requestPermission } = usePermissionManager();
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const settings = getNotificationSettings();

  const getStatusInfo = () => {
    if (!settings.enabled) {
      return {
        icon: BellOff,
        text: 'Disabled',
        variant: 'secondary' as const,
        color: 'text-muted-foreground'
      };
    }

    if (permissions.notifications === 'denied') {
      return {
        icon: AlertCircle,
        text: 'Blocked',
        variant: 'destructive' as const,
        color: 'text-destructive'
      };
    }

    if (permissions.notifications === 'granted') {
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

  const handleEnableNotifications = async () => {
    if (permissions.notifications === 'granted') {
      return;
    }

    console.log('[NotificationStatus] Requesting notification permission');
    setShowPermissionPrompt(true);
  };

  const handlePermissionAllow = async () => {
    try {
      setIsRequestingPermission(true);
      const granted = await requestPermission('notifications');
      
      if (granted) {
        setShowPermissionPrompt(false);
      }
    } catch (error) {
      console.error('[NotificationStatus] Error requesting notification permission:', error);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handlePermissionDeny = () => {
    setShowPermissionPrompt(false);
  };

  const handlePermissionClose = () => {
    setShowPermissionPrompt(false);
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  if (showText) {
    return (
      <>
        <div className={`flex items-center gap-2 ${className}`}>
          <Icon className={`h-4 w-4 ${statusInfo.color}`} />
          <span className="text-sm">
            <TranslatableText text={statusInfo.text} />
          </span>
          {permissions.notifications === 'prompt' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleEnableNotifications}
              className="ml-2"
            >
              <TranslatableText text="Enable" />
            </Button>
          )}
        </div>

        <PermissionPrompt
          type="notifications"
          isVisible={showPermissionPrompt}
          isLoading={isRequestingPermission}
          onAllow={handlePermissionAllow}
          onDeny={handlePermissionDeny}
          onClose={handlePermissionClose}
        />
      </>
    );
  }

  return (
    <>
      <Badge variant={statusInfo.variant} className={className}>
        <Icon className="h-3 w-3 mr-1" />
        <TranslatableText text={statusInfo.text} />
      </Badge>

      <PermissionPrompt
        type="notifications"
        isVisible={showPermissionPrompt}
        isLoading={isRequestingPermission}
        onAllow={handlePermissionAllow}
        onDeny={handlePermissionDeny}
        onClose={handlePermissionClose}
      />
    </>
  );
};
