
import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRateLimitHandler } from '@/hooks/use-rate-limit-handler';

interface RateLimitStatusProps {
  className?: string;
  showWhenNotLimited?: boolean;
}

export function RateLimitStatus({ className, showWhenNotLimited = false }: RateLimitStatusProps) {
  const { rateLimitInfo, formatTimeRemaining } = useRateLimitHandler();

  if (!rateLimitInfo.isRateLimited && !showWhenNotLimited) {
    return null;
  }

  if (!rateLimitInfo.isRateLimited) {
    return (
      <Alert className={className}>
        <Clock className="h-4 w-4" />
        <AlertDescription>
          API requests are running normally
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        Rate limit active. Please wait {formatTimeRemaining()} before making more requests.
        {rateLimitInfo.limitType && (
          <span className="block text-xs mt-1 opacity-75">
            Limit type: {rateLimitInfo.limitType.replace('_', ' ')}
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}
