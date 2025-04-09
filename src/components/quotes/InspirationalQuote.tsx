
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Loader2, Quote } from 'lucide-react';
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
    triggerOnce: false, // Changed to false to refetch quotes when component comes back into view
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
      }, 4000); // Changed to 4 seconds per quote
      
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
      className="p-6 bg-gradient-to-br from-theme/10 to-theme/5 rounded-xl shadow-sm mb-16"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }} // Slower initial animation
    >
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            className="flex flex-col items-center justify-center min-h-[120px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }} // Slower loading animation
          >
            <Loader2 className="h-8 w-8 text-theme animate-spin mb-4" />
            <p className="text-muted-foreground">Finding inspiration for you...</p>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            className="flex flex-col items-center justify-center min-h-[120px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }} // Slower error animation
          >
            <p className="text-muted-foreground">{error}</p>
            <button 
              onClick={fetchQuotes}
              className="mt-4 px-4 py-2 bg-theme/20 hover:bg-theme/30 text-foreground rounded-md transition-colors"
            >
              Try Again
            </button>
          </motion.div>
        ) : (
          <motion.div
            key={currentQuoteIndex}
            className="flex flex-col min-h-[120px] justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }} // Slower transition between quotes
          >
            <div className="flex mb-4 justify-center">
              <Quote className="h-8 w-8 text-theme" />
            </div>
            <p className="text-foreground text-center text-xl font-medium italic mb-2">
              "{quote}"
            </p>
            {author && (
              <p className="text-muted-foreground text-center">
                — {author}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
