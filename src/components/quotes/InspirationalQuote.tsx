
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Quote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const InspirationalQuote: React.FC = () => {
  const [quote, setQuote] = useState<string>('');
  const [author, setAuthor] = useState<string>('');
  const [quotes, setQuotes] = useState<Array<{quote: string, author: string}>>([]);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { ref, inView } = useInView({
    triggerOnce: false,
    threshold: 0.1,
  });

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching inspirational quotes from edge function');
      const { data, error } = await supabase.functions.invoke('inspirational-quotes');
      
      if (error) {
        console.error('Error fetching quotes:', error);
        setError('Could not load inspirational quotes');
        toast.error('Could not load inspirational quotes');
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
        }
      } else if (data && data.error) {
        console.error('Error from edge function:', data.error);
        setError(data.error);
        toast.error('Error loading quotes');
      } else {
        console.error('Unexpected response format:', data);
        setError('Received invalid response format');
        toast.error('Received invalid response format');
      }
    } catch (err) {
      console.error('Exception when fetching quotes:', err);
      setError('Failed to load inspirational quotes');
      toast.error('Failed to load inspirational quotes');
    } finally {
      setLoading(false);
    }
  };

  // Effect to fetch quotes when component is in view or visibility changes
  useEffect(() => {
    if (inView) {
      console.log('Quote component in view, fetching quotes');
      fetchQuotes();
      return () => {
        // Reset state when component goes out of view
        setCurrentQuoteIndex(0);
      };
    }
  }, [inView]);

  // Add effect to detect page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && inView) {
        console.log('Page became visible, fetching new quotes');
        fetchQuotes();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Add event listener for page refocus
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [inView]);

  // Effect to rotate through quotes
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
      }, 7000); // Changed from 4 seconds to 7 seconds per quote
      
      return () => clearInterval(intervalId);
    }
  }, [quotes]);

  console.log('Rendering quote component with state:', { 
    loading, 
    error, 
    quotesCount: quotes.length, 
    currentQuote: quote.substring(0, 30) + '...' 
  });

  return (
    <motion.div
      ref={ref}
      className="fixed inset-0 w-full h-full flex items-center justify-center z-10 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error"
            className="flex flex-col items-center justify-center w-full px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
          >
            <p className="text-muted-foreground opacity-100">{error}</p>
            <button 
              onClick={fetchQuotes}
              className="mt-4 px-4 py-2 text-foreground rounded-md transition-colors opacity-100 pointer-events-auto hover:underline"
            >
              Try Again
            </button>
          </motion.div>
        ) : (
          <motion.div
            key={currentQuoteIndex}
            className="flex flex-col justify-center w-full max-w-2xl px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
          >
            {!loading && quotes.length > 0 && (
              <>
                <div className="flex mb-4 justify-center">
                  <Quote className="h-8 w-8 text-theme opacity-70" />
                </div>
                <p className="text-foreground text-center text-xl font-medium italic mb-2 opacity-80">
                  "{quote}"
                </p>
                {author && (
                  <p className="text-theme text-center font-medium">
                    — {author}
                  </p>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
