import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/hooks/use-theme';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { staticTranslationService } from '@/services/staticTranslationService';

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
  const { theme } = useTheme();
  const [translatedLabel, setTranslatedLabel] = useState<string>("7-day themes");
  const isDarkMode = theme === 'dark';
  
  // Enhanced animation management
  const animationsRef = useRef<{[key: string]: any}>({});
  const animationKeyRef = useRef<number>(0);
  const [translationReady, setTranslationReady] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  
  // Safely access the translation context
  let translate, currentLanguage;
  try {
    const translationContext = useTranslation();
    translate = translationContext?.translate;
    currentLanguage = translationContext?.currentLanguage || 'en';
  } catch (error) {
    console.error('FloatingThemeStrips: Error accessing translation context', error);
    currentLanguage = 'en';
  }
  
  // Translate the label immediately with fallback
  useEffect(() => {
    console.log("FloatingThemeStrips: Translating label");
    const translateLabel = async () => {
      if (!translate) {
        console.log("FloatingThemeStrips: translate function not available, using default");
        return;
      }
      
      try {
        const result = await translate("7-day themes", "en");
        console.log("FloatingThemeStrips: Label translated to:", result);
        setTranslatedLabel(result || "7-day themes");
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
  }, [translate]);
  
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
  
  // Directly translate all themes with staticTranslationService for maximum reliability
  const translateAllThemes = useCallback(async (themes: ProcessedThemeData[]) => {
    if (!themes.length) {
      console.log("FloatingThemeStrips: No themes to translate");
      setTranslationReady(true);
      return;
    }
    
    // Always translate regardless of language to ensure consistency
    console.log(`FloatingThemeStrips: Translating ${themes.length} themes to ${currentLanguage || 'en'}`);
    
    try {
      // Extract all theme strings
      const themeTexts = themes.map(item => item.theme).filter(Boolean);
      
      if (themeTexts.length === 0) {
        console.log("FloatingThemeStrips: No valid theme texts to translate");
        setTranslatedThemes(themes);
        setTranslationReady(true);
        return;
      }
      
      // Direct translation using static service to bypass route checks
      const translationsMap = await staticTranslationService.batchTranslateTexts(themeTexts);
      
      // Apply translations
      const translated = themes.map(item => ({
        ...item,
        translatedTheme: translationsMap?.get(item.theme) || item.theme
      }));
      
      console.log("FloatingThemeStrips: Translations completed successfully");
      setTranslatedThemes(translated);
      setTranslationReady(true);
      
      // Trigger animation refresh after translations are ready
      animationKeyRef.current += 1;
    } catch (error) {
      console.error('FloatingThemeStrips: Error translating themes:', error);
      
      // Fallback to using original themes in case of error
      setTranslatedThemes(themes);
      setTranslationReady(true);
      
      // Still trigger animation refresh even with fallbacks
      animationKeyRef.current += 1;
    }
  }, [currentLanguage]);
  
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
      <div className="absolute top-[70px] right-6 z-50">
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: "reverse"
          }}
          className="px-1.5 py-0.5 text-center rounded-sm scale-75"
          style={{
            backgroundColor: `${themeColor}50`,
            borderLeft: `3px solid ${themeColor}`,
            borderRight: `3px solid ${themeColor}`,
            boxShadow: `0 0 1px 0 ${themeColor}40`,
            backdropFilter: 'blur(4px)',
          }}
        >
          <TranslatableText 
            text={translatedLabel || "7-day themes"} 
            forceTranslate={true}
            className="text-xs font-medium whitespace-nowrap"
            style={{
              color: isDarkMode ? '#ffffff' : '#000000',
              fontWeight: 500,
              letterSpacing: '0.01em',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale'
            }}
          />
        </motion.div>
      </div>
      
      <div className="absolute inset-x-0 top-20 bottom-80 pointer-events-none">
        {themesToShow.slice(0, 6).map((themeItem, index) => {
          const sectionHeight = 100 / Math.min(6, themesToShow.length);
          const randomOffset = Math.random() * 5 - 2.5;
          const yPosition = (index * sectionHeight) + (sectionHeight / 2) + randomOffset;
          
          const direction = index % 2 === 0;
          const speed = 15 + Math.random() * 10;
          
          // Create a unique and stable animation key that changes when needed
          const uniqueAnimKey = `theme-strip-${themeItem.theme}-${index}-${currentLanguage}-${animationKeyRef.current}`;
          
          // Display the translated theme if available
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
                zIndex: 15,
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
