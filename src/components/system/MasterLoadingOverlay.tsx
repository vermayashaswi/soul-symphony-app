import React from 'react';
import { cn } from '@/lib/utils';

interface MasterLoadingOverlayProps {
  isVisible: boolean;
  className?: string;
}

export const MasterLoadingOverlay: React.FC<MasterLoadingOverlayProps> = ({ 
  isVisible, 
  className 
}) => {
  if (!isVisible) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[9999] bg-background flex items-center justify-center",
        "transition-opacity duration-300",
        className
      )}
      style={{ 
        backdropFilter: 'blur(2px)',
        backgroundColor: 'hsl(var(--background) / 0.95)'
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Loading spinner */}
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-muted animate-spin border-t-primary"></div>
        </div>
        
        {/* Loading text */}
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Loading...
          </p>
        </div>
      </div>
    </div>
  );
};