
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';

export function TranslationLoadingOverlay() {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  
  // Get translation context safely
  useEffect(() => {
    try {
      const getContextValues = () => {
        try {
          const { isTranslating: contextIsTranslating, translationProgress: contextProgress } = useTranslation();
          setIsTranslating(contextIsTranslating);
          setTranslationProgress(contextProgress);
        } catch (error) {
          console.error('TranslationLoadingOverlay: Error accessing translation context', error);
        }
      };
      
      // Get values initially
      getContextValues();
      
      // Listen for language change events to update overlay
      const handleLanguageChange = () => {
        getContextValues();
      };
      
      window.addEventListener('languageChange', handleLanguageChange as EventListener);
      
      return () => {
        window.removeEventListener('languageChange', handleLanguageChange as EventListener);
      };
    } catch (error) {
      console.error('TranslationLoadingOverlay: Error setting up context access', error);
    }
  }, []);

  return (
    <AnimatePresence>
      {isTranslating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center"
        >
          <div className="flex flex-col items-center gap-6 max-w-md mx-auto px-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <Progress value={translationProgress} className="w-full" />
            <p className="text-sm text-muted-foreground">
              Translating content... {translationProgress}%
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
