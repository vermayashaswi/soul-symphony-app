
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Quote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/use-theme';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { staticTranslationService } from '@/services/staticTranslationService';

interface QuoteItem {
  quote: string;
  author: string;
  translatedQuote?: string;
  translatedAuthor?: string;
}

export const InspirationalQuote: React.FC = () => {
  const [quote, setQuote] = useState<string>('');
  const [author, setAuthor] = useState<string>('');
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [translatedQuotes, setTranslatedQuotes] = useState<QuoteItem[]>([]);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState<number>(0);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { ref, inView } = useInView({
    triggerOnce: false,
    threshold: 0.1,
  });
  const { colorTheme } = useTheme();
  const { currentLanguage, translate } = useTranslation();
  const rotationIntervalRef = useRef<number | null>(null);
  const isTranslatingRef = useRef<boolean>(false);

  useEffect(() => {
    // Set a default quote immediately for visibility testing
    setQuote("Every moment is a fresh beginning.");
    setAuthor("T.S. Eliot");
    setIsReady(true);
    
    console.log("InspirationalQuote component mounted, default quote set");
  }, []);

  // Function to translate all quotes at once
  const translateAllQuotes = async (quotesToTranslate: QuoteItem[]) => {
    if (currentLanguage === 'en' || quotesToTranslate.length === 0) {
      return quotesToTranslate;
    }
    
    isTranslatingRef.current = true;
    console.log(`Translating ${quotesToTranslate.length} quotes to ${currentLanguage}`);
    
    try {
      // Extract all texts that need translation
      const textsToTranslate: string[] = [];
      quotesToTranslate.forEach(q => {
        textsToTranslate.push(q.quote);
        if (q.author) textsToTranslate.push(q.author);
      });
      
      // Pre-translate all texts at once
      const translationsMap = await staticTranslationService.preTranslate(textsToTranslate, "en");
      
      // Apply translations to quotes
      const translated = quotesToTranslate.map(q => ({
        ...q,
        translatedQuote: translationsMap.get(q.quote) || q.quote,
        translatedAuthor: q.author ? (translationsMap.get(q.author) || q.author) : undefined
      }));
      
      console.log(`Successfully translated ${translated.length} quotes`);
      return translated;
    } catch (error) {
      console.error('Failed to translate quotes:', error);
      return quotesToTranslate;
    } finally {
      isTranslatingRef.current = false;
    }
  };

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
        
        // Translate all quotes at once
        const translatedQuotes = await translateAllQuotes(shuffledQuotes);
        setTranslatedQuotes(translatedQuotes);
        
        if (translatedQuotes.length > 0) {
          const firstQuote = translatedQuotes[0];
          setQuote(currentLanguage === 'en' ? firstQuote.quote : (firstQuote.translatedQuote || firstQuote.quote));
          setAuthor(currentLanguage === 'en' ? (firstQuote.author || 'Unknown') : (firstQuote.translatedAuthor || firstQuote.author || 'Unknown'));
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

  // Setup quote rotation
  const setupQuoteRotation = () => {
    // Clear existing interval if any
    if (rotationIntervalRef.current !== null) {
      clearInterval(rotationIntervalRef.current);
      rotationIntervalRef.current = null;
    }
    
    // Only setup rotation if we have quotes
    if ((currentLanguage === 'en' ? quotes : translatedQuotes).length > 0) {
      rotationIntervalRef.current = window.setInterval(() => {
        // Skip rotation if currently translating
        if (isTranslatingRef.current) return;
        
        setCurrentQuoteIndex((prevIndex) => {
          const quotesList = currentLanguage === 'en' ? quotes : translatedQuotes;
          const newIndex = (prevIndex + 1) % quotesList.length;
          
          const nextQuote = quotesList[newIndex];
          setQuote(currentLanguage === 'en' ? nextQuote.quote : (nextQuote.translatedQuote || nextQuote.quote));
          setAuthor(currentLanguage === 'en' ? (nextQuote.author || 'Unknown') : (nextQuote.translatedAuthor || nextQuote.author || 'Unknown'));
          
          return newIndex;
        });
      }, 7000);
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

  // Handle language change
  useEffect(() => {
    const handleLanguageChange = async () => {
      if (quotes.length === 0) return;
      
      console.log(`Language changed to ${currentLanguage}, translating quotes`);
      
      // If switching to English, no translation needed
      if (currentLanguage === 'en') {
        if (quotes.length > 0 && currentQuoteIndex < quotes.length) {
          setQuote(quotes[currentQuoteIndex].quote);
          setAuthor(quotes[currentQuoteIndex].author || 'Unknown');
        }
      } else {
        // Re-translate all quotes if needed
        const newTranslatedQuotes = await translateAllQuotes(quotes);
        setTranslatedQuotes(newTranslatedQuotes);
        
        // Update current quote
        if (newTranslatedQuotes.length > 0 && currentQuoteIndex < newTranslatedQuotes.length) {
          const currentItem = newTranslatedQuotes[currentQuoteIndex];
          setQuote(currentItem.translatedQuote || currentItem.quote);
          setAuthor(currentItem.translatedAuthor || currentItem.author || 'Unknown');
        }
      }
      
      // Reset and restart the rotation interval
      setupQuoteRotation();
    };
    
    handleLanguageChange();
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [currentLanguage, quotes]);

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
  }, [quotes, translatedQuotes]);

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
              {`"${quote}"`}
            </p>
            {author && (
              <p className="text-theme text-center font-bold text-sm">
                {`— ${author}`}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InspirationalQuote;
