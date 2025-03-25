
import React from 'react';
import { AudioWaveform } from 'lucide-react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  withText?: boolean;
}

export function FeelsophyLogo({ className = "", size = 'md', withText = true }: LogoProps) {
  // Size mappings
  const sizeMap = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };
  
  const textSizeMap = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`relative ${sizeMap[size]} rounded-full bg-gradient-to-r from-blue-400 to-purple-600 flex items-center justify-center overflow-hidden`}>
        {/* Buddha silhouette */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1/2 h-2/3 bg-white opacity-20 rounded-t-full"></div>
        </div>
        
        {/* Voice waveform overlay */}
        <AudioWaveform 
          className="relative text-white" 
          size={size === 'sm' ? 16 : size === 'md' ? 20 : 24} 
          strokeWidth={2.5}
        />
      </div>
      
      {withText && (
        <span className={`font-semibold ${textSizeMap[size]}`}>
          Feelosophy
        </span>
      )}
    </div>
  );
}

export default FeelsophyLogo;
