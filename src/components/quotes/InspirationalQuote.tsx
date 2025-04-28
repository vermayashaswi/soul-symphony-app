
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Quote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/use-theme';
import { TranslatableText } from '@/components/translation/TranslatableText';

export const InspirationalQuote: React.FC = () => {
  const [quote, setQuote] = useState<string>('');
  const [author, setAuthor] = useState<string>('');
  const [quotes, setQuotes] = useState<Array<{quote: string, author: string}>>([]);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState<number>(0);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { ref, inView } = useInView({
    triggerOnce: false,
    threshold: 0.1,
  });
  const { colorTheme } = useTheme();

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
          setQuote(shuffledQuotes[0].quote);
          setAuthor(shuffledQuotes[0].author || 'Unknown');
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

  useEffect(() => {
    if (inView) {
      console.log('Quote component in view, fetching quotes');
      fetchQuotes();
      return () => {
        setCurrentQuoteIndex(0);
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
    };
  }, [inView]);

  useEffect(() => {
    if (quotes.length > 0) {
      console.log('Setting up quote rotation with', quotes.length, 'quotes');
      const intervalId = setInterval(() => {
        setCurrentQuoteIndex((prevIndex) => {
          const newIndex = (prevIndex + 1) % quotes.length;
          setQuote(quotes[newIndex].quote);
          setAuthor(quotes[newIndex].author || 'Unknown');
          return newIndex;
        });
      }, 7000);
      
      return () => clearInterval(intervalId);
    }
  }, [quotes]);

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
            key={currentQuoteIndex}
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
              <TranslatableText text={`"${quote}"`} />
            </p>
            {author && (
              <p className="text-theme text-center font-bold text-sm">
                <TranslatableText text={`— ${author}`} />
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
