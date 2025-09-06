import { useState, useRef, useCallback } from 'react';

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
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const hasStartedRef = useRef(false);

  const cleanup = useCallback(() => {
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current = [];
  }, []);

  const startTyping = useCallback(() => {
    if (!text || hasStartedRef.current) return;
    
    hasStartedRef.current = true;
    cleanup();
    
    setDisplayText('');
    setIsComplete(false);
    setIsTyping(true);

    const initialTimeout = setTimeout(() => {
      let currentIndex = 0;
      
      const typeNextChar = () => {
        if (currentIndex <= text.length) {
          setDisplayText(text.slice(0, currentIndex));
          currentIndex++;
          
          if (currentIndex <= text.length) {
            const charTimeout = setTimeout(typeNextChar, speed);
            timeoutsRef.current.push(charTimeout);
          } else {
            setIsComplete(true);
            setIsTyping(false);
            onComplete?.();
          }
        }
      };
      
      typeNextChar();
    }, startDelay);

    timeoutsRef.current.push(initialTimeout);
  }, [text, speed, startDelay, onComplete, cleanup]);

  const reset = useCallback(() => {
    cleanup();
    hasStartedRef.current = false;
    setDisplayText('');
    setIsComplete(false);
    setIsTyping(false);
  }, [cleanup]);

  return {
    displayText,
    isComplete,
    isTyping,
    startTyping,
    reset
  };
};