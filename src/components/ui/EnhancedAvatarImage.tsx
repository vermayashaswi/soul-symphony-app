import React, { useState, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RefreshCw, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUserAvatar } from '@/hooks/useUserAvatar';

interface EnhancedAvatarImageProps {
  userId?: string;
  src?: string;
  alt?: string;
  size?: number;
  className?: string;
  fallbackIcon?: React.ElementType;
  showRefreshButton?: boolean;
  showLoadingState?: boolean;
}

export const EnhancedAvatarImage: React.FC<EnhancedAvatarImageProps> = ({
  userId,
  src: externalSrc,
  alt = "Avatar",
  size = 192,
  className,
  fallbackIcon: FallbackIcon = User,
  showRefreshButton = false,
  showLoadingState = true
}) => {
  const { avatarUrl, isLoading, error, refreshAvatar, retry } = useUserAvatar(size);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Use external src if provided, otherwise use hook result
  const finalSrc = externalSrc || avatarUrl;

  const handleImageLoad = useCallback(() => {
    console.log('[EnhancedAvatarImage] Image loaded successfully:', finalSrc);
    setImageLoading(false);
    setImageError(false);
  }, [finalSrc]);

  const handleImageError = useCallback(() => {
    console.warn('[EnhancedAvatarImage] Image failed to load:', finalSrc);
    setImageLoading(false);
    setImageError(true);
  }, [finalSrc]);

  const handleRefresh = useCallback(async () => {
    console.log('[EnhancedAvatarImage] Refresh triggered - imageError:', imageError);
    setImageError(false);
    setImageLoading(true);
    
    if (imageError) {
      console.log('[EnhancedAvatarImage] Retrying due to image error');
      await retry();
    } else {
      console.log('[EnhancedAvatarImage] Refreshing avatar from source');
      await refreshAvatar();
    }
  }, [imageError, retry, refreshAvatar]);

  const getInitials = useCallback(() => {
    if (!alt || alt === "Avatar") return "U";
    return alt.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  }, [alt]);

  const showLoading = showLoadingState && (isLoading || imageLoading);
  const hasError = error || imageError;

  return (
    <div className="relative group">
      <Avatar className={cn("transition-all duration-200", className)}>
        {finalSrc && !hasError && (
          <AvatarImage
            src={finalSrc}
            alt={alt}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={cn(
              "transition-opacity duration-200",
              showLoading && "opacity-50"
            )}
          />
        )}
        <AvatarFallback className={cn(
          "bg-muted text-muted-foreground transition-all duration-200",
          showLoading && "animate-pulse"
        )}>
          {showLoading ? (
            <div className="w-5 h-5 border-2 border-current border-r-transparent rounded-full animate-spin" />
          ) : (
            <span className="text-sm font-medium">
              {getInitials()}
            </span>
          )}
        </AvatarFallback>
      </Avatar>

      {showRefreshButton && (error || imageError) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className={cn(
            "absolute -top-1 -right-1 h-6 w-6 p-0 rounded-full",
            "bg-background shadow-md border",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          )}
          disabled={isLoading}
        >
          <RefreshCw className={cn(
            "h-3 w-3",
            isLoading && "animate-spin"
          )} />
        </Button>
      )}
    </div>
  );
};