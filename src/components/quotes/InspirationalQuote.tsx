
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Loader2, Quote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const InspirationalQuote: React.FC = () => {
  const [quote, setQuote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const fetchNewQuote = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase.functions.invoke('inspirational-quotes');
      
      if (error) {
        console.error('Error fetching quote:', error);
        setError('Could not load an inspirational quote');
        toast.error('Could not load an inspirational quote');
        return;
      }
      
      if (data && data.quote) {
        setQuote(data.quote);
      } else if (data && data.error) {
        setError(data.error);
        toast.error('Error loading quote');
      }
    } catch (err) {
      console.error('Exception when fetching quote:', err);
      setError('Failed to load an inspirational quote');
      toast.error('Failed to load an inspirational quote');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (inView) {
      fetchNewQuote();
      
      // Set up interval to fetch a new quote every 60 seconds
      const interval = setInterval(fetchNewQuote, 60 * 1000);
      
      return () => clearInterval(interval);
    }
  }, [inView]);

  return (
    <motion.div
      ref={ref}
      className="p-6 bg-gradient-to-br from-theme/10 to-theme/5 rounded-xl shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            className="flex flex-col items-center justify-center min-h-[200px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Loader2 className="h-8 w-8 text-theme animate-spin mb-4" />
            <p className="text-muted-foreground">Finding inspiration for you...</p>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            className="flex flex-col items-center justify-center min-h-[200px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="text-muted-foreground">{error}</p>
            <button 
              onClick={fetchNewQuote}
              className="mt-4 px-4 py-2 bg-theme/20 hover:bg-theme/30 text-foreground rounded-md transition-colors"
            >
              Try Again
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="quote"
            className="flex flex-col min-h-[200px] justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex mb-4 justify-center">
              <Quote className="h-8 w-8 text-theme" />
            </div>
            <p className="text-foreground text-center text-xl font-medium italic mb-6">
              {quote}
            </p>
            <div className="flex justify-center">
              <button 
                onClick={fetchNewQuote}
                className="px-4 py-2 bg-theme/20 hover:bg-theme/30 text-foreground rounded-md transition-colors"
              >
                New Quote
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
