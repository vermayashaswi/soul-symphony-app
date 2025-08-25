import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/hooks/use-theme';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';

interface ThemeData {
  theme: string;
  sentiment: number;
  translatedTheme?: string;
}

interface ProcessedThemeData extends ThemeData {
  count: number;
}

interface FloatingThemeStripsProps {
  themesData: ThemeData[];
  themeColor: string;
}

const FloatingThemeStrips: React.FC<FloatingThemeStripsProps> = ({ 
  themesData,
  themeColor
}) => {
  const [uniqueThemes, setUniqueThemes] = useState<ProcessedThemeData[]>([]);
  const [translatedThemes, setTranslatedThemes] = useState<ProcessedThemeData[]>([]);
  // Defensive hook usage to prevent runtime errors during app initialization
  let theme = 'light';
  
  try {
    const themeData = useTheme();
    theme = themeData.theme;
  } catch (error) {
    console.warn('FloatingThemeStrips: ThemeProvider not ready, using defaults');
  }
  const [translatedLabel, setTranslatedLabel] = useState<string>("2-week themes");
  const isDarkMode = theme === 'dark';
  
  // Enhanced animation management
  const animationsRef = useRef<{[key: string]: any}>({});
  const animationKeyRef = useRef<number>(0);
  const [translationReady, setTranslationReady] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  
  // Use translation context
  const { translate, currentLanguage } = useTranslation();
  
  // Direct translation function using Google Translate only
  const directTranslate = async (text: string): Promise<string> => {
    console.log(`FloatingThemeStrips: GOOGLE TRANSLATE ONLY - Translating "${text}" to ${currentLanguage}`);
    try {
      if (currentLanguage === 'en' || !text) return text || '';
      const result = await translate(text, 'en');
      console.log(`FloatingThemeStrips: Google Translate result: "${result}"`);
      return result || text;
    } catch (error) {
      console.error(`FloatingThemeStrips: Google Translate error for "${text}":`, error);
      return text;
    }
  };
  
  // Translate the label immediately with fallback
  useEffect(() => {
    console.log("FloatingThemeStrips: Translating label");
    const translateLabel = async () => {
      try {
        // Use direct translation to ensure it works regardless of route
        const result = await directTranslate("2-week themes");
        console.log("FloatingThemeStrips: Label translated to:", result);
        setTranslatedLabel(result || "2-week themes");
      } catch (error) {
        console.error('FloatingThemeStrips: Error translating label:', error);
        // Keep using existing label
      }
    };
    
    translateLabel();
    
    // Listen for language changes
    const handleLanguageChange = async () => {
      console.log("FloatingThemeStrips: Language change detected");
      
      // Clear existing animations on language change
      Object.values(animationsRef.current).forEach((anim: any) => {
        if (anim && typeof anim.stop === 'function') {
          try {
            anim.stop();
          } catch (e) {
            console.error("FloatingThemeStrips: Error stopping animation", e);
          }
        }
      });
      
      // Reset animations ref to clear old references
      animationsRef.current = {};
      
      // Update translated label
      translateLabel();
      
      // Reset translation ready state temporarily
      setTranslationReady(false);
      
      // Force animation refresh with new key
      animationKeyRef.current += 1;
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [currentLanguage]);
  
  // Process themes data with memoization
  const processThemeData = useMemo(() => {
    console.log("FloatingThemeStrips: Processing theme data", { themesCount: themesData?.length || 0 });
    
    if (!themesData?.length) return [];
    
    const themeMap = new Map<string, { count: number, sentiment: number }>();
    
    themesData.forEach(item => {
      if (!item?.theme) return; // Skip invalid items
      
      if (!themeMap.has(item.theme)) {
        themeMap.set(item.theme, { count: 1, sentiment: item.sentiment });
      } else {
        const existing = themeMap.get(item.theme)!;
        themeMap.set(item.theme, { 
          count: existing.count + 1,
          sentiment: (existing.sentiment + item.sentiment) / 2
        });
      }
    });
    
    // Convert map to array and ensure proper typing
    const processed = Array.from(themeMap.entries())
      .map(([theme, { count, sentiment }]) => ({ 
        theme,
        sentiment,
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    
    console.log("FloatingThemeStrips: Theme data processed", { 
      processedCount: processed.length,
      samples: processed.slice(0, 2).map(t => t.theme)
    });
    
    return processed;
  }, [themesData]);
  
  // Update unique themes when processed data changes
  useEffect(() => {
    if (processThemeData.length > 0) {
      console.log("FloatingThemeStrips: Updating unique themes", { count: processThemeData.length });
      setUniqueThemes(processThemeData);
      
      // Force animation refresh on data change
      animationKeyRef.current += 1;
      
      // Clear old animation references when data changes
      Object.values(animationsRef.current).forEach((anim: any) => {
        if (anim && typeof anim.stop === 'function') {
          try {
            anim.stop();
          } catch (e) {
            console.error("FloatingThemeStrips: Error stopping animation on data change", e);
          }
        }
      });
      animationsRef.current = {};
    }
  }, [processThemeData]);
  
  // Directly translate all themes with Google Translate only
  const translateAllThemes = useCallback(async (themes: ProcessedThemeData[]) => {
    if (!themes.length) {
      console.log("FloatingThemeStrips: No themes to translate");
      setTranslationReady(true);
      return;
    }
    
    console.log(`FloatingThemeStrips: GOOGLE TRANSLATE ONLY - Translating ${themes.length} themes to ${currentLanguage || 'en'}`);
    
    try {
      // Extract all theme strings
      const themeTexts = themes.map(item => item.theme).filter(Boolean);
      
      if (themeTexts.length === 0) {
        console.log("FloatingThemeStrips: No valid theme texts to translate");
        setTranslatedThemes(themes);
        setTranslationReady(true);
        return;
      }
      
      // Use Google Translate service only
      const translations = await Promise.all(themeTexts.map(async (text) => {
        try {
          const translated = await translate(text, 'en');
          console.log(`FloatingThemeStrips: Google Translate: "${text}" → "${translated}"`);
          return { original: text, translated };
        } catch (e) {
          console.error(`FloatingThemeStrips: Google Translate error for "${text}"`, e);
          return { original: text, translated: text };
        }
      }));
      
      // Create a map of translations for lookup
      const translationsMap = new Map<string, string>();
      translations.forEach(t => translationsMap.set(t.original, t.translated));
      
      // Apply translations to theme data
      const translated = themes.map(item => ({
        ...item,
        translatedTheme: translationsMap.get(item.theme) || item.theme
      }));
      
      console.log("FloatingThemeStrips: Google Translate completed successfully", {
        translatedCount: translated.length,
        samples: translated.slice(0, 2).map(t => ({ 
          original: t.theme,
          translated: t.translatedTheme 
        }))
      });
      
      setTranslatedThemes(translated);
      setTranslationReady(true);
      
      // Trigger animation refresh after translations are ready
      animationKeyRef.current += 1;
    } catch (error) {
      console.error('FloatingThemeStrips: Error with Google Translate:', error);
      
      // Fallback to using original themes in case of error
      setTranslatedThemes(themes);
      setTranslationReady(true);
      
      // Still trigger animation refresh even with fallbacks
      animationKeyRef.current += 1;
    }
  }, [currentLanguage, translate]);
  
  // Handle language changes & uniqueThemes updates
  useEffect(() => {
    if (uniqueThemes.length > 0) {
      console.log(`FloatingThemeStrips: Themes updated or language changed to ${currentLanguage}`);
      translateAllThemes(uniqueThemes);
    }
  }, [currentLanguage, uniqueThemes, translateAllThemes]);

  // Initialize on first load
  useEffect(() => {
    if (isInitialLoad && uniqueThemes.length > 0) {
      console.log("FloatingThemeStrips: Initial load completed");
      setIsInitialLoad(false);
    }
  }, [isInitialLoad, uniqueThemes]);

  // Clean up animations on unmount
  useEffect(() => {
    console.log("FloatingThemeStrips: Setting up cleanup");
    
    return () => {
      console.log("FloatingThemeStrips: Cleaning up animations");
      
      // Clear any ongoing animations to prevent memory leaks
      Object.entries(animationsRef.current).forEach(([key, anim]) => {
        if (anim && typeof anim.stop === 'function') {
          try {
            console.log(`FloatingThemeStrips: Cleaning animation: ${key}`);
            anim.stop();
            delete animationsRef.current[key];
          } catch (e) {
            console.error(`FloatingThemeStrips: Error cleaning animation: ${key}`, e);
          }
        }
      });
    };
  }, []);

  // Skip rendering if we don't have data
  if (!themesData?.length) {
    console.log("FloatingThemeStrips: No themes data, skipping render");
    return null;
  }

  // Get current theme list based on language and translation status
  const themesToShow = translationReady ? translatedThemes : uniqueThemes;
  
  // Additional safety check to ensure we have themes to display
  if (!themesToShow?.length) {
    console.log("FloatingThemeStrips: No themes to show, skipping render");
    return null;
  }

  console.log(`FloatingThemeStrips: Rendering with animation key ${animationKeyRef.current}, language: ${currentLanguage}`);

  return (
    <div className="relative w-full h-full overflow-hidden">
      
      <div className="absolute inset-x-0 top-20 bottom-80 pointer-events-none">
        {themesToShow.slice(0, 6).map((themeItem, index) => {
          const sectionHeight = 100 / Math.min(6, themesToShow.length);
          const randomOffset = Math.random() * 5 - 2.5;
          const yPosition = (index * sectionHeight) + (sectionHeight / 2) + randomOffset;
          
          const direction = index % 2 === 0;
          const speed = 15 + Math.random() * 10;
          
          // Create a unique and stable animation key that changes when needed
          const uniqueAnimKey = `theme-strip-${themeItem.theme}-${index}-${currentLanguage}-${animationKeyRef.current}`;
          
          // Get the translated theme (guaranteed to exist)
          const displayText = themeItem.translatedTheme || themeItem.theme;
          
          return (
            <motion.div
              key={uniqueAnimKey}
              className="absolute left-0 w-auto h-8 px-3 py-1 flex items-center rounded-sm"
              style={{
                top: `${yPosition}%`,
                backgroundColor: `${themeColor}50`,
                borderLeft: `3px solid ${themeColor}`,
                borderRight: `3px solid ${themeColor}`,
                boxShadow: `0 0 1px 0 ${themeColor}40`,
                backdropFilter: 'blur(4px)',
                zIndex: 5,
              }}
              initial={{ 
                x: direction ? -300 : '100vw',
                opacity: 0 
              }}
              animate={{ 
                x: direction ? ['100vw', '0vw', '-100vw'] : ['-100vw', '0vw', '100vw'],
                opacity: [0, 1, 0]
              }}
              transition={{
                duration: speed,
                repeat: Infinity,
                repeatType: 'loop',
                ease: 'linear',
                delay: index * 2.5,
              }}
              onAnimationStart={(definition) => {
                // Store animation reference for cleanup
                animationsRef.current[uniqueAnimKey] = definition;
              }}
            >
              <span 
                className="text-sm md:text-base font-medium whitespace-nowrap"
                style={{
                  color: isDarkMode ? '#ffffff' : '#000000',
                  textShadow: 'none',
                  fontWeight: 500,
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                }}
              >
                {displayText}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default FloatingThemeStrips;
