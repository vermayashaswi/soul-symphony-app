
import React, { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getNetworkStatus, getOptimizedImageQuality, NetworkStatus } from '@/utils/network';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  lowQualitySrc?: string;
  placeholderColor?: string;
  className?: string;
}

export function OptimizedImage({
  src,
  alt,
  fallbackSrc,
  lowQualitySrc,
  placeholderColor,
  className,
  ...props
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(getNetworkStatus());
  const [imageSrc, setImageSrc] = useState<string>('');
  const [renderPlaceholder, setRenderPlaceholder] = useState(true);
  
  useEffect(() => {
    // Update network status
    setNetworkStatus(getNetworkStatus());
    
    // Choose appropriate image based on network conditions
    const quality = getOptimizedImageQuality(networkStatus);
    
    if (quality === 'low' && lowQualitySrc) {
      setImageSrc(lowQualitySrc);
    } else {
      setImageSrc(src);
    }
    
    // For very slow connections, we might want to delay loading images
    if (networkStatus.speed === 'slow') {
      const timer = setTimeout(() => {
        setRenderPlaceholder(false);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setRenderPlaceholder(false);
    }
  }, [src, lowQualitySrc, networkStatus.speed]);
  
  const handleLoad = () => {
    setLoaded(true);
    setError(false);
  };
  
  const handleError = () => {
    setError(true);
    if (fallbackSrc && imageSrc !== fallbackSrc) {
      setImageSrc(fallbackSrc);
    }
  };

  return (
    <div className={cn("relative", className)}>
      {(!loaded || renderPlaceholder) && !error && (
        <Skeleton 
          className="absolute inset-0 w-full h-full" 
          style={{ backgroundColor: placeholderColor }}
        />
      )}
      
      {!networkStatus.online && !loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
          <span className="text-sm text-muted-foreground">Image not available offline</span>
        </div>
      )}
      
      {imageSrc && (
        <img
          src={imageSrc}
          alt={alt}
          className={cn(
            "w-full h-auto transition-opacity duration-300",
            !loaded && "opacity-0",
            loaded && "opacity-100"
          )}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
      )}
    </div>
  );
}

export default OptimizedImage;
