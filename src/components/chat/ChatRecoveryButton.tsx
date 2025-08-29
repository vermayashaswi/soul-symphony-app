import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatRecoveryButtonProps {
  isStuck: boolean;
  onForceRecovery: () => void;
  className?: string;
}

export const ChatRecoveryButton: React.FC<ChatRecoveryButtonProps> = ({
  isStuck,
  onForceRecovery,
  className
}) => {
  if (!isStuck) return null;

  return (
    <div className={cn("flex items-center justify-center p-4 border border-destructive/20 rounded-lg bg-destructive/5", className)}>
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <div className="flex-1">
          <p className="text-sm font-medium text-destructive">
            Chat appears to be stuck
          </p>
          <p className="text-xs text-muted-foreground">
            The conversation has been processing for over 10 minutes
          </p>
        </div>
        <Button
          onClick={onForceRecovery}
          variant="outline"
          size="sm"
          className="border-destructive/20 text-destructive hover:bg-destructive/10"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset Chat
        </Button>
      </div>
    </div>
  );
};