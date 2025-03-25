
import React from 'react';

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
      <div className={`relative ${sizeMap[size]} rounded-full bg-gradient-to-r from-amber-400 to-orange-600 flex items-center justify-center overflow-hidden`}>
        {/* Meditation silhouette based on the reference image */}
        <div className="flex items-center justify-center">
          <svg 
            viewBox="0 0 100 100" 
            className="w-4/5 h-4/5" 
            fill="white"
          >
            {/* Simplified meditation silhouette inspired by the provided image */}
            <path d="M50,15 C53,15 56,12 56,9 C56,6 53,3 50,3 C47,3 44,6 44,9 C44,12 47,15 50,15 Z" />
            <path d="M37,34 L63,34 C63,44 58,50 50,50 C42,50 37,44 37,34 Z" />
            <path d="M32,84 C32,70 40,65 50,65 C60,65 68,70 68,84 C68,84 62,82 50,82 C38,82 32,84 32,84 Z" />
            <path d="M20,65 L30,60 C25,50 25,46 30,36 L25,34 C18,48 18,52 20,65 Z" />
            <path d="M80,65 L70,60 C75,50 75,46 70,36 L75,34 C82,48 82,52 80,65 Z" />
          </svg>
        </div>
      </div>
      
      {withText && (
        <span className={`font-semibold ${textSizeMap[size]} bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-orange-600`}>
          Feelosophy
        </span>
      )}
    </div>
  );
}

export default FeelsophyLogo;
