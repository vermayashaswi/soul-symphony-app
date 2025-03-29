
import React from 'react';
import { cn } from '@/lib/utils';

export type LogoSize = "small" | "normal" | "large";

interface SouloLogoProps {
  className?: string;
  size?: LogoSize;
  textClassName?: string;
  smileyClassName?: string;
}

const SouloLogo = ({
  className = "",
  size = "normal",
  textClassName = "",
  smileyClassName = ""
}: SouloLogoProps) => {
  // Size classes for the smiley
  const sizeClasses = {
    small: "w-4 h-4 mx-0.5",
    normal: "w-5 h-5 mx-0.5",
    large: "w-6 h-6 mx-0.5",
  };
  
  return (
    <span className={cn("font-semibold inline-flex items-center", textClassName, className)}>
      S<span className="mx-[0.5px]">O</span>
      <span className={cn("relative inline-block", sizeClasses[size], smileyClassName)}>
        {/* U-shaped character instead of circle */}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="relative w-full h-full flex items-center justify-center">
            {/* U shape */}
            <div className="w-full h-3/4 border-2 border-current rounded-b-full border-t-0 flex items-end pb-[2px]">
              {/* Eyes */}
              <span className="absolute top-[25%] left-[25%] w-[15%] h-[15%] rounded-full bg-current"></span>
              <span className="absolute top-[25%] right-[25%] w-[15%] h-[15%] rounded-full bg-current"></span>
            </div>
          </span>
        </span>
      </span>
      <span className="mx-[0.5px]">L</span>
      <span className="mx-[0.5px]">O</span>
    </span>
  );
};

export default SouloLogo;
