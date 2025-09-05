import { useState, useEffect, useCallback } from 'react';

interface UseTypewriterOptions {
  speed?: number; // milliseconds per character
  startDelay?: number; // delay before starting
  onComplete?: () => void; // callback when typing is complete
}

export const useTypewriter = (
  text: string, 
  options: UseTypewriterOptions = {}
) => {
  const { speed = 50, startDelay = 0, onComplete } = options;
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const startTyping = useCallback(() => {
    if (!text) return;
    
    setDisplayText('');
    setIsComplete(false);
    setIsTyping(true);

    const timeout = setTimeout(() => {
      let currentIndex = 0;
      
      const typeNextChar = () => {
        if (currentIndex <= text.length) {
          setDisplayText(text.slice(0, currentIndex));
          currentIndex++;
          
          if (currentIndex <= text.length) {
            setTimeout(typeNextChar, speed);
          } else {
            setIsComplete(true);
            setIsTyping(false);
            onComplete?.();
          }
        }
      };
      
      typeNextChar();
    }, startDelay);

    return () => clearTimeout(timeout);
  }, [text, speed, startDelay, onComplete]);

  const reset = useCallback(() => {
    setDisplayText('');
    setIsComplete(false);
    setIsTyping(false);
  }, []);

  return {
    displayText,
    isComplete,
    isTyping,
    startTyping,
    reset
  };
};