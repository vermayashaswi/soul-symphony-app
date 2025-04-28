
import React from 'react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface ThemeBoxesProps {
  themes?: string[];
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const ThemeBoxes: React.FC<ThemeBoxesProps> = ({ 
  themes = [], 
  className = "",
  size = 'md' 
}) => {
  if (!themes || themes.length === 0) {
    return null;
  }
  
  const sizeClasses = {
    sm: 'text-xs py-0.5 px-1.5',
    md: 'text-xs py-1 px-2',
    lg: 'text-sm py-1 px-3'
  };
  
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {themes.map((theme, index) => (
        <div 
          key={`${theme}-${index}`} 
          className={`bg-primary/10 text-primary rounded-md flex items-center ${sizeClasses[size]}`}
        >
          <TranslatableText text={theme} />
        </div>
      ))}
    </div>
  );
};

export default ThemeBoxes;
