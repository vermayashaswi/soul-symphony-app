
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
      <div className={`relative ${sizeMap[size]} rounded-full bg-gradient-to-r from-purple-400 to-violet-600 flex items-center justify-center overflow-hidden`}>
        {/* Waveform instead of meditation silhouette */}
        <AudioWaveform 
          className="text-white" 
          size={size === 'sm' ? 16 : size === 'md' ? 20 : 24} 
          strokeWidth={2.5}
        />
      </div>
      
      {withText && (
        <span className={`font-bold ${textSizeMap[size]} bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-violet-600 brightness-110`}>
          Feelosophy
        </span>
      )}
    </div>
  );
}

export default FeelsophyLogo;
