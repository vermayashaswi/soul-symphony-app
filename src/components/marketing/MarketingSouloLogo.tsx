
import React from 'react';
import { cn } from '@/lib/utils';

export type LogoSize = "small" | "normal" | "large" | "medium";

interface MarketingSouloLogoProps {
  className?: string;
  size?: LogoSize;
  textClassName?: string;
  smileyClassName?: string;
  animate?: boolean;
  splashMode?: boolean;
}

const MarketingSouloLogo = ({
  className = "",
  size = "normal",
  textClassName = "",
  smileyClassName = "",
  animate = false,
  splashMode = false
}: MarketingSouloLogoProps) => {
  
  // Size classes for the smiley
  const sizeClasses = {
    small: "w-4 h-4 mx-0.5",
    normal: "w-5 h-5 mx-0.5",
    large: "w-6 h-6 mx-0.5",
    medium: "w-5.5 h-5.5 mx-0.5",
  };
  
  // Fixed color theme for marketing - always uses primary/purple
  const themeTextClass = splashMode ? "text-purple-600" : "text-primary";

  return (
    <span className={cn("font-bold inline-flex items-center", themeTextClass, textClassName, className)}>
      <span>S</span>
      <span>O</span>
      <span className={cn("relative inline-block", sizeClasses[size], smileyClassName)}>
        {/* U-shaped character instead of circle */}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="relative w-full h-full flex items-center justify-center">
            {/* U shape */}
            <div className={cn(
              "w-full h-3/4 border-2 border-current rounded-b-full border-t-0 flex items-end pb-[2px]",
              splashMode && "border-purple-400"
            )}>
              {/* Eyes */}
              <span className={cn(
                "absolute top-[25%] left-[25%] w-[15%] h-[15%] rounded-full bg-current",
                splashMode && "bg-purple-400"
              )}></span>
              <span className={cn(
                "absolute top-[25%] right-[25%] w-[15%] h-[15%] rounded-full bg-current",
                splashMode && "bg-purple-400"
              )}></span>
            </div>
          </span>
        </span>
      </span>
      <span>L</span>
      <span>O</span>
    </span>
  );
};

export default MarketingSouloLogo;
