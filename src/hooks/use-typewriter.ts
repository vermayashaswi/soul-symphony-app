import { useState, useRef, useCallback } from 'react';

interface UseTypewriterOptions {
  startDelay?: number; // delay before starting
  onComplete?: () => void; // callback when typing is complete
}

interface TypewriterSection {
  text: string;
  speed?: number;
  pauseAfter?: number;
}

export const useTypewriter = (
  input: string | TypewriterSection[], 
  options: UseTypewriterOptions = {}
) => {
  const { startDelay = 0, onComplete } = options;
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
    if (hasStartedRef.current) return;
    
    hasStartedRef.current = true;
    cleanup();
    
    setDisplayText('');
    setIsComplete(false);
    setIsTyping(true);

    const initialTimeout = setTimeout(() => {
      // Handle both string and sections array
      if (typeof input === 'string') {
        // Original string mode
        let currentIndex = 0;
        const speed = 50;
        
        const typeNextChar = () => {
          if (currentIndex <= input.length) {
            setDisplayText(input.slice(0, currentIndex));
            currentIndex++;
            
            if (currentIndex <= input.length) {
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
      } else {
        // Sections mode
        let sectionIndex = 0;
        let charIndex = 0;
        
        const typeNextChar = () => {
          if (sectionIndex >= input.length) {
            setIsComplete(true);
            setIsTyping(false);
            onComplete?.();
            return;
          }
          
          const currentSection = input[sectionIndex];
          const currentSpeed = currentSection.speed || 50;
          
          if (charIndex < currentSection.text.length) {
            setDisplayText(prev => prev + currentSection.text[charIndex]);
            charIndex++;
            
            const timeout = setTimeout(typeNextChar, currentSpeed);
            timeoutsRef.current.push(timeout);
          } else {
            // Section complete, add pause and move to next section
            const pauseDuration = currentSection.pauseAfter || 500;
            
            const pauseTimeout = setTimeout(() => {
              sectionIndex++;
              charIndex = 0;
              typeNextChar();
            }, pauseDuration);
            
            timeoutsRef.current.push(pauseTimeout);
          }
        };
        
        typeNextChar();
      }
    }, startDelay);

    timeoutsRef.current.push(initialTimeout);
  }, [input, startDelay, onComplete, cleanup]);

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