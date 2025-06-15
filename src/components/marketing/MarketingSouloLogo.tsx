
import React from 'react';
import { useMarketingTheme } from '@/contexts/MarketingThemeProvider';

interface MarketingSouloLogoProps {
  size?: 'small' | 'normal' | 'large';
}

const MarketingSouloLogo: React.FC<MarketingSouloLogoProps> = ({ 
  size = 'normal'
}) => {
  const { theme, systemTheme } = useMarketingTheme();
  
  const actualTheme = theme === 'system' ? systemTheme : theme;
  const isDark = actualTheme === 'dark';
  
  const sizeMap = {
    small: { width: 28, height: 28 },
    normal: { width: 36, height: 36 },
    large: { width: 48, height: 48 }
  };
  
  const { width, height } = sizeMap[size];
  
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
    >
      <circle
        cx="50"
        cy="50"
        r="45"
        fill={isDark ? "#8b5cf6" : "#3b82f6"}
        stroke={isDark ? "#7c3aed" : "#2563eb"}
        strokeWidth="2"
      />
      <path
        d="M30 40 Q50 20 70 40 Q50 60 30 40"
        fill="white"
        opacity="0.9"
      />
      <circle
        cx="50"
        cy="45"
        r="8"
        fill={isDark ? "#8b5cf6" : "#3b82f6"}
      />
    </svg>
  );
};

export default MarketingSouloLogo;
