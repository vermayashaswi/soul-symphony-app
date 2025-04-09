
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SpeechDotsProps {
  className?: string;
  active?: boolean;
}

const SpeechDots: React.FC<SpeechDotsProps> = ({ 
  className = "",
  active = true
}) => {
  const [utteranceState, setUtteranceState] = useState<number>(0);
  
  useEffect(() => {
    if (!active) return;
    
    const utteranceInterval = setInterval(() => {
      setUtteranceState(prev => (prev + 1) % 3); // Cycle through 3 states: 0, 1, 2
    }, 300); // Fast animation for speech utterance
    
    return () => clearInterval(utteranceInterval);
  }, [active]);
  
  return (
    <div className={cn("flex space-x-1 justify-center", className)}>
      <span 
        className={cn(
          "block rounded-full bg-current transition-all duration-150",
          utteranceState === 0 ? "w-[8px] h-[8px] opacity-100" : "w-[5px] h-[5px] opacity-40"
        )}
      ></span>
      <span 
        className={cn(
          "block rounded-full bg-current transition-all duration-150",
          utteranceState === 1 ? "w-[8px] h-[8px] opacity-100" : "w-[5px] h-[5px] opacity-40"
        )}
      ></span>
      <span 
        className={cn(
          "block rounded-full bg-current transition-all duration-150",
          utteranceState === 2 ? "w-[8px] h-[8px] opacity-100" : "w-[5px] h-[5px] opacity-40"
        )}
      ></span>
    </div>
  );
};

export default SpeechDots;
