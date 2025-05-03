
import React, { useEffect } from 'react';
import { Maximize2, X } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { cn } from '@/lib/utils';

interface FullscreenWrapperProps {
  isFullScreen: boolean;
  toggleFullScreen: () => void;
  children: React.ReactNode;
}

export const FullscreenWrapper: React.FC<FullscreenWrapperProps> = ({ 
  isFullScreen, 
  toggleFullScreen, 
  children 
}) => {
  // Add keyboard event listener to handle ESC key for exiting fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        toggleFullScreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Prevent scrolling when in fullscreen mode
    if (isFullScreen) {
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Restore scrolling when component unmounts or exits fullscreen
      document.body.style.overflow = '';
    };
  }, [isFullScreen, toggleFullScreen]);

  return (
    <div className={cn(
      "relative rounded-lg overflow-hidden transition-all duration-300 ease-in-out",
      isFullScreen 
        ? "fixed top-0 left-0 w-screen h-screen z-[9999] bg-background/95 backdrop-blur-sm m-0 p-0" 
        : "w-full h-[400px] md:h-[500px] bg-background/50"
    )}>
      <button
        onClick={toggleFullScreen}
        className={cn(
          "absolute z-[10000] bg-background/80 backdrop-blur-sm rounded-full text-foreground/90 hover:text-foreground transition-colors",
          isFullScreen 
            ? "top-6 right-6 p-3" // Larger button when in fullscreen
            : "top-4 right-4 p-1.5" // Original size when not fullscreen
        )}
        aria-label={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
        title={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {isFullScreen ? (
          <X className="h-6 w-6" />
        ) : (
          <Maximize2 className="h-5 w-5" />
        )}
        <span className="sr-only">
          <TranslatableText text={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"} />
        </span>
      </button>
      <div className={cn(
        "flex items-center justify-center h-full w-full",
        isFullScreen && "pt-0" // Remove top padding in fullscreen mode
      )}>
        {children}
      </div>
    </div>
  );
};
