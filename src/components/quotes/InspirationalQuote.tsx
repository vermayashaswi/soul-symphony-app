
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Quote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/use-theme';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';

interface QuoteItem {
  quote: string;
  author: string;
}

export const InspirationalQuote: React.FC = () => {
  const [quote, setQuote] = useState<string>('');
  const [author, setAuthor] = useState<string>('');
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState<number>(0);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const { ref, inView } = useInView({
    triggerOnce: false,
    threshold: 0.1,
  });
  const { colorTheme } = useTheme();
  const { currentLanguage } = useTranslation();
  const rotationIntervalRef = useRef<number | null>(null);
  const isTranslatingRef = useRef<boolean>(false);
  const languageRef = useRef<string>(currentLanguage);
  const rotationPausedRef = useRef<boolean>(false);

  useEffect(() => {
    // Set a default quote immediately for visibility testing
    setQuote("Every moment is a fresh beginning.");
    setAuthor("T.S. Eliot");
    setIsReady(true);
    
    console.log("InspirationalQuote component mounted, default quote set");
  }, []);

  const fetchQuotes = async () => {
    try {
      setError(null);
      
      console.log('Fetching inspirational quotes from edge function');
      const { data, error } = await supabase.functions.invoke('inspirational-quotes');
      
      if (error) {
        console.error('Error fetching quotes:', error);
        setError('Could not load inspirational quotes');
        return;
      }
      
      console.log('Received response from inspirational-quotes edge function:', data);
      
      if (data && data.quotes && Array.isArray(data.quotes)) {
        console.log('Successfully parsed quotes:', data.quotes);
        // Shuffle the quotes for more randomness
        const shuffledQuotes = [...data.quotes].sort(() => Math.random() - 0.5);
        setQuotes(shuffledQuotes);
        
        if (shuffledQuotes.length > 0) {
          const firstQuote = shuffledQuotes[0];
          setQuote(firstQuote.quote);
          setAuthor(firstQuote.author || 'Unknown');
          setIsReady(true);
        }
      } else if (data && data.error) {
        console.error('Error from edge function:', data.error);
        setError(data.error);
      } else {
        console.error('Unexpected response format:', data);
        setError('Received invalid response format');
      }
    } catch (err) {
      console.error('Exception when fetching quotes:', err);
      setError('Failed to load inspirational quotes');
    }
  };

  // Setup quote rotation with translation protection
  const setupQuoteRotation = () => {
    // Clear existing interval if any
    if (rotationIntervalRef.current !== null) {
      clearInterval(rotationIntervalRef.current);
      rotationIntervalRef.current = null;
    }
    
    // Only setup rotation if we have quotes
    if (quotes.length > 0) {
      rotationIntervalRef.current = window.setInterval(() => {
        // Skip rotation if currently translating or rotation is paused
        if (isTranslatingRef.current || rotationPausedRef.current) {
          console.log('Quote rotation skipped - translation in progress or rotation paused');
          return;
        }
        
        setCurrentQuoteIndex((prevIndex) => {
          const newIndex = (prevIndex + 1) % quotes.length;
          
          const nextQuote = quotes[newIndex];
          if (nextQuote) {
            console.log(`Quote rotating to index ${newIndex}: "${nextQuote.quote.substring(0, 30)}..."`);
            setQuote(nextQuote.quote);
            setAuthor(nextQuote.author || 'Unknown');
          }
          
          return newIndex;
        });
      }, 10000); // Increased from 7 seconds to 10 seconds to give more time for translations
    }
  };

  useEffect(() => {
    if (inView) {
      console.log('Quote component in view, fetching quotes');
      fetchQuotes();
      return () => {
        setCurrentQuoteIndex(0);
        if (rotationIntervalRef.current !== null) {
          clearInterval(rotationIntervalRef.current);
          rotationIntervalRef.current = null;
        }
      };
    }
  }, [inView]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && inView) {
        console.log('Page became visible, fetching new quotes');
        fetchQuotes();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      if (rotationIntervalRef.current !== null) {
        clearInterval(rotationIntervalRef.current);
        rotationIntervalRef.current = null;
      }
    };
  }, [inView]);

  // Handle language change - pause rotation during translation
  useEffect(() => {
    if (languageRef.current !== currentLanguage) {
      console.log(`Language changed to ${currentLanguage}, pausing quote rotation`);
      rotationPausedRef.current = true;
      languageRef.current = currentLanguage;
      
      // Resume rotation after a delay to allow translations to complete
      setTimeout(() => {
        console.log('Resuming quote rotation after language change');
        rotationPausedRef.current = false;
      }, 3000);
    }
  }, [currentLanguage]);

  // Listen for language change events
  useEffect(() => {
    const handleLanguageChangeEvent = () => {
      // Pause rotation during language change
      console.log('Language change event detected, pausing quote rotation');
      rotationPausedRef.current = true;
      
      // Update language reference
      if (languageRef.current !== currentLanguage) {
        languageRef.current = currentLanguage;
      }
      
      // Resume rotation after a delay
      setTimeout(() => {
        console.log('Resuming quote rotation after language change event');
        rotationPausedRef.current = false;
      }, 3000);
    };
    
    window.addEventListener('languageChange', handleLanguageChangeEvent as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChangeEvent as EventListener);
    };
  }, [currentLanguage]);

  // Setup quote rotation when quotes are loaded
  useEffect(() => {
    if (quotes.length > 0) {
      setupQuoteRotation();
    }
    
    return () => {
      if (rotationIntervalRef.current !== null) {
        clearInterval(rotationIntervalRef.current);
        rotationIntervalRef.current = null;
      }
    };
  }, [quotes]);

  // Setup translation tracking
  const handleTranslationStart = () => {
    isTranslatingRef.current = true;
    setIsTranslating(true); // Added state update for UI feedback
  };

  const handleTranslationEnd = () => {
    isTranslatingRef.current = false;
    setIsTranslating(false); // Added state update for UI feedback
  };

  if (!isReady && !error) {
    return null;
  }

  return (
    <div 
      ref={ref}
      className="flex items-center justify-center w-full py-2"
    >
      <AnimatePresence mode="wait">
        {isReady && (
          <motion.div
            key={`quote-${currentQuoteIndex}-${currentLanguage}`}
            className="flex flex-col justify-center w-full max-w-2xl px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
          >
            <div className="flex mb-2 justify-center">
              <Quote className="h-6 w-6 text-theme opacity-100" />
            </div>
            <p className="text-foreground text-center text-lg font-medium italic mb-1">
              <TranslatableText 
                text={`"${quote}"`} 
                forceTranslate={true}
                onTranslationStart={handleTranslationStart}
                onTranslationEnd={handleTranslationEnd}
              />
            </p>
            {author && (
              <p className="text-theme text-center font-bold text-sm">
                <TranslatableText 
                  text={`— ${author}`}
                  forceTranslate={true}
                  onTranslationStart={handleTranslationStart}
                  onTranslationEnd={handleTranslationEnd}
                />
              </p>
            )}
            {isTranslating && (
              <div className="flex justify-center mt-2">
                <div className="w-2 h-2 bg-theme/50 rounded-full animate-pulse"></div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default InspirationalQuote;
