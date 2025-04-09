
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import SpeechDots from './SpeechDots';

export type LogoSize = "small" | "normal" | "large" | "medium";

interface SouloLogoProps {
  className?: string;
  size?: LogoSize;
  textClassName?: string;
  smileyClassName?: string;
  useColorTheme?: boolean;
  animate?: boolean;
  utteringWords?: boolean;
}

const SouloLogo = ({
  className = "",
  size = "normal",
  textClassName = "",
  smileyClassName = "",
  useColorTheme = true,
  animate = false,
  utteringWords = false
}: SouloLogoProps) => {
  const { colorTheme } = useTheme();
  const [animationState, setAnimationState] = useState<'full' | 'soul' | 'none'>('full');
  
  // Size classes for the smiley - increased by 25%
  const sizeClasses = {
    small: "w-5 h-5 mx-0.5", // w-4 → w-5, h-4 → h-5
    normal: "w-6 h-6 mx-0.5", // w-5 → w-6, h-5 → h-6
    large: "w-7.5 h-7.5 mx-0.5", // w-6 → w-7.5, h-6 → h-7.5
    medium: "w-7 h-7 mx-0.5", // w-5.5 → w-7, h-5.5 → h-7
  };
  
  // Size classes for the speech dots - increased by 25%
  const dotsSizeClasses = {
    small: "w-3.5 h-2", // w-3 → w-3.5, h-1.5 → h-2
    normal: "w-4.5 h-2.5", // w-3.5 → w-4.5, h-2 → h-2.5
    large: "w-5 h-3", // w-4 → w-5, h-2.5 → h-3
    medium: "w-4.5 h-2.5", // w-3.5 → w-4.5, h-2 → h-2.5
  };
  
  // Apply color theme if useColorTheme is true
  const themeTextClass = useColorTheme ? "text-primary" : "";

  useEffect(() => {
    if (!animate) return;

    const animationInterval = setInterval(() => {
      setAnimationState((prev) => {
        if (prev === 'full') return 'soul';
        if (prev === 'soul') return 'none';
        return 'full';
      });
    }, 800); // Animation cycle

    return () => clearInterval(animationInterval);
  }, [animate]);
  
  return (
    <span className={cn("font-semibold inline-flex items-center text-125", themeTextClass, textClassName, className)}>
      <span className={animationState === 'none' ? "opacity-0" : "opacity-100 transition-opacity duration-300"}>S</span>
      <span className={animationState === 'none' ? "opacity-0" : "opacity-100 transition-opacity duration-300"}>O</span>
      <span className={cn("relative inline-block", sizeClasses[size], smileyClassName)}>
        {/* U-shaped character instead of circle */}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="relative w-full h-full flex items-center justify-center">
            {/* U shape */}
            <div className="w-full h-3/4 border-2 border-current rounded-b-full border-t-0 flex items-end pb-[2px]">
              {/* Eyes */}
              <span className="absolute top-[25%] left-[25%] w-[15%] h-[15%] rounded-full bg-current"></span>
              <span className="absolute top-[25%] right-[25%] w-[15%] h-[15%] rounded-full bg-current"></span>
              
              {/* Speech dots positioned in the U */}
              {utteringWords && (
                <span className={cn("absolute top-[40%] left-1/2 -translate-x-1/2", dotsSizeClasses[size])}>
                  <SpeechDots className="scale-75 text-current" active={true} />
                </span>
              )}
            </div>
          </span>
        </span>
      </span>
      <span className={animationState === 'none' ? "opacity-0" : "opacity-100 transition-opacity duration-300"}>L</span>
      <span className={animationState === 'none' ? "opacity-0" : "opacity-100 transition-opacity duration-300"}>O</span>
    </span>
  );
};

export default SouloLogo;
