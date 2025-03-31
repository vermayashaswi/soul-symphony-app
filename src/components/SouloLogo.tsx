
import React from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';

export type LogoSize = "small" | "normal" | "large";

interface SouloLogoProps {
  className?: string;
  size?: LogoSize;
  textClassName?: string;
  logoClassName?: string;
  useColorTheme?: boolean;
}

const SouloLogo = ({
  className = "",
  size = "normal",
  textClassName = "",
  logoClassName = "",
  useColorTheme = true
}: SouloLogoProps) => {
  const { colorTheme } = useTheme();
  
  // Size classes for the logo
  const sizeClasses = {
    small: "w-4 h-4 mx-0.5",
    normal: "w-5 h-5 mx-0.5",
    large: "w-6 h-6 mx-0.5",
  };
  
  // Apply color theme if useColorTheme is true
  const themeTextClass = useColorTheme ? "text-primary" : "";
  
  return (
    <span className={cn("font-semibold inline-flex items-center", themeTextClass, textClassName, className)}>
      S<span className="mx-[0.5px]">O</span>
      <span className={cn("relative inline-block", sizeClasses[size], logoClassName)}>
        <img 
          src="/lovable-uploads/58d999f1-51c6-401a-bad2-41869a71052b.png" 
          alt="SOULO" 
          className="w-full h-full object-cover rounded-full"
        />
      </span>
      <span className="mx-[0.5px]">L</span>
      <span className="mx-[0.5px]">O</span>
    </span>
  );
};

export default SouloLogo;
