
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import { Mic } from 'lucide-react';

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
  const [micScale, setMicScale] = useState<number>(1);
  
  // Size classes for the smiley
  const sizeClasses = {
    small: "w-4 h-4 mx-0.5",
    normal: "w-5 h-5 mx-0.5",
    large: "w-6 h-6 mx-0.5",
    medium: "w-5.5 h-5.5 mx-0.5",
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
  
  // Microphone animation
  useEffect(() => {
    if (!utteringWords) return;
    
    const micInterval = setInterval(() => {
      setMicScale(prev => prev === 1 ? 1.2 : 1); // Simple pulse animation
    }, 500); // Slower pulse for microphone
    
    return () => clearInterval(micInterval);
  }, [utteringWords]);
  
  return (
    <span className={cn("font-bold inline-flex items-center", themeTextClass, textClassName, className)}>
      <span className={animationState === 'none' ? "opacity-0" : "opacity-100 transition-opacity duration-300"}>S</span>
      <span className={animationState === 'none' ? "opacity-0" : "opacity-100 transition-opacity duration-300"}>O</span>
      <span className={cn("relative inline-block", sizeClasses[size], smileyClassName)}>
        {/* Circular smiley face */}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="relative w-full h-full flex items-center justify-center">
            {/* Main circle */}
            <div className="w-full h-full border-2 border-current rounded-full relative flex items-center justify-center">
              {/* Eyes */}
              <span className="absolute top-[30%] left-[30%] w-[12%] h-[12%] rounded-full bg-current"></span>
              <span className="absolute top-[30%] right-[30%] w-[12%] h-[12%] rounded-full bg-current"></span>
              
              {/* Smile */}
              <div className="absolute bottom-[25%] left-1/2 transform -translate-x-1/2">
                <div className="w-[40%] h-[20%] border-b-2 border-current rounded-full border-t-0 border-l-0 border-r-0"></div>
              </div>
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
