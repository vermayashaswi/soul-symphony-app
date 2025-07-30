/**
 * Enhanced Avatar component with retry logic, loading states, and error handling
 */
import React, { useState, useCallback } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { createRetryAvatarUrl } from '@/utils/avatarUtils';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { User } from 'lucide-react';

interface EnhancedAvatarProps {
  src?: string | null;
  fallbackText?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showLoadingState?: boolean;
  maxRetries?: number;
  onLoadSuccess?: () => void;
  onLoadError?: (error: string) => void;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-16 w-16',
  xl: 'h-24 w-24'
};

export const EnhancedAvatar: React.FC<EnhancedAvatarProps> = ({
  src,
  fallbackText = '',
  size = 'md',
  className,
  showLoadingState = true,
  maxRetries = 2,
  onLoadSuccess,
  onLoadError
}) => {
  const [isLoading, setIsLoading] = useState(Boolean(src));
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(src);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    onLoadSuccess?.();
  }, [onLoadSuccess]);

  const handleImageError = useCallback(() => {
    setIsLoading(false);
    
    if (retryCount < maxRetries && src) {
      console.log(`[EnhancedAvatar] Retrying avatar load (attempt ${retryCount + 1}/${maxRetries})`);
      setRetryCount(prev => prev + 1);
      setCurrentSrc(createRetryAvatarUrl(src, retryCount + 1));
      setIsLoading(true);
      return;
    }
    
    setHasError(true);
    const errorMsg = `Failed to load avatar after ${retryCount + 1} attempts`;
    console.warn(`[EnhancedAvatar] ${errorMsg}`);
    onLoadError?.(errorMsg);
  }, [retryCount, maxRetries, src, onLoadError]);

  // Reset state when src changes
  React.useEffect(() => {
    if (src !== currentSrc) {
      setCurrentSrc(src);
      setRetryCount(0);
      setHasError(false);
      setIsLoading(Boolean(src));
    }
  }, [src, currentSrc]);

  if (showLoadingState && isLoading && currentSrc) {
    return (
      <Skeleton className={cn(sizeClasses[size], 'rounded-full', className)} />
    );
  }

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {currentSrc && !hasError && (
        <AvatarImage
          src={currentSrc}
          onLoad={handleImageLoad}
          onError={handleImageError}
          className="object-cover"
        />
      )}
      <AvatarFallback className="bg-muted">
        {fallbackText ? (
          <span className="text-sm font-medium text-muted-foreground">
            {fallbackText.substring(0, 2).toUpperCase()}
          </span>
        ) : (
          <User className="h-4 w-4 text-muted-foreground" />
        )}
      </AvatarFallback>
    </Avatar>
  );
};