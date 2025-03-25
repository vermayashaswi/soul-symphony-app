
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
      <div className={`relative ${sizeMap[size]} rounded-full bg-gradient-to-r from-purple-400 to-indigo-600 flex items-center justify-center overflow-hidden`}>
        {/* Meditating person silhouette */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg 
            viewBox="0 0 100 100" 
            className="w-3/4 h-3/4 absolute opacity-20" 
            fill="white"
          >
            {/* Simplified meditation pose silhouette */}
            <path d="M50,30 C55,30 59,25 59,20 C59,15 55,10 50,10 C45,10 41,15 41,20 C41,25 45,30 50,30 Z" />
            <path d="M30,90 C30,70 45,65 50,65 C55,65 70,70 70,90 C70,90 63,85 50,85 C37,85 30,90 30,90 Z" />
            <path d="M38,50 C38,50 40,60 50,60 C60,60 62,50 62,50 C62,50 58,55 50,55 C42,55 38,50 38,50 Z" />
            <path d="M35,40 L65,40 C65,45 60,50 50,50 C40,50 35,45 35,40 Z" />
          </svg>
        </div>
        
        {/* Voice waveform overlay */}
        <AudioWaveform 
          className="relative text-white z-10" 
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
