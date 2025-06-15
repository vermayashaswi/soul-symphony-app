
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface RateLimitInfo {
  isRateLimited: boolean;
  retryAfter?: number;
  limitType?: string;
  resetTime?: Date;
}

interface RateLimitResponse {
  error?: string;
  message?: string;
  limitType?: string;
  retryAfter?: number;
}

export function useRateLimitHandler() {
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo>({
    isRateLimited: false
  });

  const handleRateLimitResponse = useCallback((response: Response, responseData?: any) => {
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      const resetTime = new Date(Date.now() + (retryAfter * 1000));
      
      const limitInfo: RateLimitInfo = {
        isRateLimited: true,
        retryAfter,
        limitType: responseData?.limitType,
        resetTime
      };

      setRateLimitInfo(limitInfo);

      // Show user-friendly toast message
      const message = getLimitMessage(responseData?.limitType, retryAfter);
      toast.error(message, {
        duration: 5000,
        action: {
          label: 'Understood',
          onClick: () => {},
        },
      });

      return true; // Indicates rate limit was handled
    }

    // Clear rate limit state if request was successful
    if (response.ok && rateLimitInfo.isRateLimited) {
      setRateLimitInfo({ isRateLimited: false });
    }

    return false; // No rate limit
  }, [rateLimitInfo.isRateLimited]);

  const checkRetryAvailability = useCallback(() => {
    if (!rateLimitInfo.isRateLimited || !rateLimitInfo.resetTime) {
      return true;
    }

    const now = new Date();
    const canRetry = now >= rateLimitInfo.resetTime;

    if (canRetry) {
      setRateLimitInfo({ isRateLimited: false });
    }

    return canRetry;
  }, [rateLimitInfo]);

  const getRemainingTime = useCallback(() => {
    if (!rateLimitInfo.isRateLimited || !rateLimitInfo.resetTime) {
      return 0;
    }

    const now = new Date();
    const remaining = Math.max(0, rateLimitInfo.resetTime.getTime() - now.getTime());
    return Math.ceil(remaining / 1000); // Return seconds
  }, [rateLimitInfo]);

  const formatTimeRemaining = useCallback(() => {
    const seconds = getRemainingTime();
    
    if (seconds <= 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }, [getRemainingTime]);

  return {
    rateLimitInfo,
    handleRateLimitResponse,
    checkRetryAvailability,
    getRemainingTime,
    formatTimeRemaining,
    isRateLimited: rateLimitInfo.isRateLimited
  };
}

function getLimitMessage(limitType?: string, retryAfter?: number): string {
  const timeStr = retryAfter ? formatDuration(retryAfter) : 'a moment';
  
  switch (limitType) {
    case 'user_minute':
      return `You're sending requests too quickly. Please wait ${timeStr} before trying again.`;
    case 'user_hour':
      return `You've reached your hourly limit. Please wait ${timeStr} before making more requests.`;
    case 'ip_minute':
      return `Too many requests from your network. Please wait ${timeStr} before trying again.`;
    case 'ip_hour':
      return `Your network has reached the hourly limit. Please wait ${timeStr} before making more requests.`;
    default:
      return `Rate limit exceeded. Please wait ${timeStr} before trying again.`;
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
}
