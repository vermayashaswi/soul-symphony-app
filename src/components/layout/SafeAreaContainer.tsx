
import React from 'react';
import { cn } from '@/lib/utils';
import { useSafeArea } from './SafeAreaProvider';

interface SafeAreaContainerProps {
  children: React.ReactNode;
  className?: string;
  applyTop?: boolean;
  applyBottom?: boolean;
  applyLeft?: boolean;
  applyRight?: boolean;
}

export const SafeAreaContainer: React.FC<SafeAreaContainerProps> = ({
  children,
  className,
  applyTop = true,
  applyBottom = true,
  applyLeft = true,
  applyRight = true
}) => {
  const { insets, isNative, isReady } = useSafeArea();

  if (!isReady) {
    return <div className={className}>{children}</div>;
  }

  const safeAreaStyles: React.CSSProperties = {};
  
  if (isNative) {
    if (applyTop && insets.top > 0) {
      safeAreaStyles.paddingTop = `${insets.top}px`;
    }
    if (applyBottom && insets.bottom > 0) {
      safeAreaStyles.paddingBottom = `${insets.bottom}px`;
    }
    if (applyLeft && insets.left > 0) {
      safeAreaStyles.paddingLeft = `${insets.left}px`;
    }
    if (applyRight && insets.right > 0) {
      safeAreaStyles.paddingRight = `${insets.right}px`;
    }
  }

  return (
    <div 
      className={cn(
        // CSS safe area support for modern devices
        applyTop && 'pt-[env(safe-area-inset-top)]',
        applyBottom && 'pb-[env(safe-area-inset-bottom)]',
        applyLeft && 'pl-[env(safe-area-inset-left)]',
        applyRight && 'pr-[env(safe-area-inset-right)]',
        className
      )}
      style={safeAreaStyles}
    >
      {children}
    </div>
  );
};
