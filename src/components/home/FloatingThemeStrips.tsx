
import React, { useEffect, useState, useRef, useMemo } from 'react';
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
  const { translate, currentLanguage } = useTranslation();
  const [translatedLabel, setTranslatedLabel] = useState<string>("7-day themes");
  const isDarkMode = theme === 'dark';
  
  // Enhanced animation management
  const animationsRef = useRef<{[key: string]: any}>({});
  const [animationKey, setAnimationKey] = useState<number>(0);
  const [translationReady, setTranslationReady] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  
  // Debug state for animation status
  const [debugStatus, setDebugStatus] = useState<string>("initializing");
  
  // Translate the label
  useEffect(() => {
    console.log("FloatingThemeStrips: Translating label");
    const translateLabel = async () => {
      if (!translate) return;
      
      try {
        const result = await translate("7-day themes", "en");
        setTranslatedLabel(result);
        console.log("FloatingThemeStrips: Label translated successfully");
      } catch (error) {
        console.error('FloatingThemeStrips: Error translating label:', error);
      }
    };
    
    translateLabel();
    
    // Listen for language changes
    const handleLanguageChange = async () => {
      console.log("FloatingThemeStrips: Language change detected");
      setDebugStatus("language-changed");
      
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
      setAnimationKey(prev => prev + 1);
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [translate]);
  
  // Process themes data with memoization
  const processThemeData = useMemo(() => {
    console.log("FloatingThemeStrips: Processing theme data", { themesCount: themesData?.length || 0 });
    setDebugStatus("processing-themes");
    
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
      setDebugStatus("themes-updated");
      
      // Force animation refresh on data change
      setAnimationKey(prev => prev + 1);
      
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
  
  // Translate all themes at once with improved error handling
  const translateAllThemes = useCallback(async (themes: ProcessedThemeData[]) => {
    if (currentLanguage === 'en' || !themes.length) {
      console.log("FloatingThemeStrips: No need for translation (English or no themes)");
      setTranslatedThemes(themes);
      setTranslationReady(true);
      return;
    }
    
    setDebugStatus("translating-themes");
    console.log(`FloatingThemeStrips: Translating ${themes.length} themes to ${currentLanguage}`);
    
    try {
      // Extract all theme strings
      const themeTexts = themes.map(item => item.theme).filter(Boolean);
      
      if (themeTexts.length === 0) {
        console.log("FloatingThemeStrips: No valid theme texts to translate");
        setTranslatedThemes(themes);
        setTranslationReady(true);
        return;
      }
      
      // Pre-translate all at once with retry mechanism
      let translationsMap: Map<string, string>;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          translationsMap = await staticTranslationService.batchTranslateTexts(themeTexts);
          
          // Check if we got enough translations
          if (translationsMap.size > 0) {
            break;
          }
          
          console.warn(`FloatingThemeStrips: Attempt ${attempts + 1} returned empty translations, retrying...`);
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`FloatingThemeStrips: Translation attempt ${attempts + 1} failed:`, error);
          attempts++;
          
          if (attempts >= maxAttempts) {
            throw error;
          }
          
          await new Promise(resolve => setTimeout(resolve, 500 * attempts));
        }
      }
      
      // Apply translations
      const translated = themes.map(item => ({
        ...item,
        translatedTheme: translationsMap?.get(item.theme) || item.theme
      }));
      
      console.log("FloatingThemeStrips: Translations completed successfully");
      setTranslatedThemes(translated);
      setTranslationReady(true);
      setDebugStatus("translations-ready");
      
      // Trigger animation refresh after translations are ready
      setAnimationKey(prev => prev + 1);
    } catch (error) {
      console.error('FloatingThemeStrips: Error translating themes:', error);
      
      // Fallback to using original themes in case of error
      const fallbackThemes = themes.map(item => ({
        ...item,
        translatedTheme: item.theme // Use original theme as fallback
      }));
      
      console.log("FloatingThemeStrips: Using fallback translations");
      setTranslatedThemes(fallbackThemes);
      setTranslationReady(true);
      setDebugStatus("translations-fallback");
      
      // Still trigger animation refresh even with fallbacks
      setAnimationKey(prev => prev + 1);
    }
  }, [currentLanguage]);
  
  // Handle language changes & uniqueThemes updates
  useEffect(() => {
    if (uniqueThemes.length > 0) {
      console.log(`FloatingThemeStrips: Unique themes updated or language changed to ${currentLanguage}`);
      translateAllThemes(uniqueThemes);
    }
  }, [currentLanguage, uniqueThemes, translateAllThemes]);

  // Initialize on first load
  useEffect(() => {
    if (isInitialLoad && uniqueThemes.length > 0) {
      console.log("FloatingThemeStrips: Initial load completed");
      setIsInitialLoad(false);
      setDebugStatus("initialized");
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
  const themesToShow = currentLanguage === 'en' ? uniqueThemes : (translationReady ? translatedThemes : uniqueThemes);
  
  // Additional safety check to ensure we have themes to display
  if (!themesToShow?.length) {
    console.log("FloatingThemeStrips: No themes to show, skipping render");
    return null;
  }

  console.log(`FloatingThemeStrips: Rendering with status ${debugStatus}, animation key ${animationKey}`);

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
          <span 
            className="text-xs font-medium whitespace-nowrap"
            style={{
              color: isDarkMode ? '#ffffff' : '#000000',
              fontWeight: 500,
              letterSpacing: '0.01em',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale'
            }}
          >
            {translatedLabel}
          </span>
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
          const uniqueAnimKey = `theme-strip-${themeItem.theme}-${index}-${currentLanguage}-${animationKey}`;
          
          // Display the translated theme if available
          const displayText = currentLanguage === 'en' ? 
            themeItem.theme : 
            (themeItem.translatedTheme || themeItem.theme);
          
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
                // Store animation reference for cleanup and log it
                console.log(`FloatingThemeStrips: Animation started for ${uniqueAnimKey}`);
                animationsRef.current[uniqueAnimKey] = definition;
              }}
              onAnimationComplete={() => {
                // Log animation completion for debugging
                console.log(`FloatingThemeStrips: Animation completed for ${uniqueAnimKey}`);
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
