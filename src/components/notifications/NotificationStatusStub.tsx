
import React from 'react';
import { BellOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface NotificationStatusProps {
  className?: string;
  showText?: boolean;
}

export const NotificationStatus: React.FC<NotificationStatusProps> = ({ 
  className, 
  showText = false 
}) => {
  const statusInfo = {
    icon: BellOff,
    text: 'Disabled',
    variant: 'secondary' as const,
    color: 'text-muted-foreground'
  };

  const Icon = statusInfo.icon;

  if (showText) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Icon className={`h-4 w-4 ${statusInfo.color}`} />
        <span className="text-sm">
          <TranslatableText text={statusInfo.text} />
        </span>
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
