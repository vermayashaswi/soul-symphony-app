
import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

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
  return (
    <div className={`relative rounded-lg overflow-hidden transition-all duration-300 ease-in-out ${
      isFullScreen 
        ? 'fixed top-0 left-0 w-screen h-screen z-50 bg-background p-4 flex items-center justify-center' 
        : 'w-full h-[400px] md:h-[500px] bg-background/50'
    }`}>
      <button
        onClick={toggleFullScreen}
        className="absolute top-4 right-4 z-10 bg-background/80 backdrop-blur-sm p-1.5 rounded-full text-foreground/80 hover:text-foreground transition-colors"
        title={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {isFullScreen ? (
          <Minimize2 className="h-5 w-5" />
        ) : (
          <Maximize2 className="h-5 w-5" />
        )}
        <span className="sr-only">
          <TranslatableText text={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"} />
        </span>
      </button>
      <div className={`flex items-center justify-center h-full`}>
        {children}
      </div>
    </div>
  );
};
