
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
  const animationsRef = useRef<{[key: string]: any}>({});
  const animationKeyRef = useRef<number>(0);
  const [renderKey, setRenderKey] = useState<number>(0);
  
  // Translate the label
  useEffect(() => {
    const translateLabel = async () => {
      if (!translate) return;
      
      try {
        const result = await translate("7-day themes", "en");
        setTranslatedLabel(result);
      } catch (error) {
        console.error('Error translating label:', error);
      }
    };
    
    translateLabel();
    
    // Listen for language changes
    const handleLanguageChange = async () => {
      translateLabel();
      // Force re-render of animations when language changes
      setRenderKey(prev => prev + 1);
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [translate]);
  
  // Process themes data with memoization
  const processThemeData = useMemo(() => {
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
    return Array.from(themeMap.entries())
      .map(([theme, { count, sentiment }]) => ({ 
        theme,
        sentiment,
        count // Now explicitly included in ProcessedThemeData interface
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [themesData]);
  
  // Update unique themes when processed data changes
  useEffect(() => {
    if (processThemeData.length > 0) {
      setUniqueThemes(processThemeData);
      // Force animation refresh on data change
      animationKeyRef.current += 1;
    }
  }, [processThemeData]);
  
  // Translate all themes at once
  const translateAllThemes = async (themes: ProcessedThemeData[]) => {
    if (currentLanguage === 'en' || !themes.length) {
      setTranslatedThemes(themes);
      return;
    }
    
    try {
      // Extract all theme strings
      const themeTexts = themes.map(item => item.theme);
      
      // Pre-translate all at once
      const translationsMap = await staticTranslationService.preTranslate(themeTexts);
      
      // Apply translations
      const translated = themes.map(item => ({
        ...item,
        translatedTheme: translationsMap.get(item.theme) || item.theme
      }));
      
      setTranslatedThemes(translated);
    } catch (error) {
      console.error('Error translating themes:', error);
      // Fallback to using original themes in case of error
      const fallbackThemes = themes.map(item => ({
        ...item,
        translatedTheme: item.theme // Use original theme as fallback
      }));
      setTranslatedThemes(fallbackThemes);
    }
  };
  
  // Handle language changes & uniqueThemes updates
  useEffect(() => {
    if (uniqueThemes.length > 0) {
      translateAllThemes(uniqueThemes);
    }
  }, [currentLanguage, uniqueThemes]);

  // Clean up animations on unmount
  useEffect(() => {
    return () => {
      // Clear any ongoing animations to prevent memory leaks
      Object.values(animationsRef.current).forEach(anim => {
        if (anim && typeof anim.stop === 'function') {
          anim.stop();
        }
      });
      animationsRef.current = {};
    };
  }, []);

  if (!themesData?.length) {
    return null;
  }

  // Get current theme list based on language
  const themesToShow = currentLanguage === 'en' ? uniqueThemes : translatedThemes;
  
  // Additional safety check to ensure we have themes to display
  if (!themesToShow?.length) {
    return null;
  }

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
          
          // Create a stable key for animations that updates with language changes
          // Using animationKeyRef.current instead of animationKey
          const uniqueAnimationKey = `theme-strip-${themeItem.theme}-${index}-${currentLanguage}-${animationKeyRef.current}-${renderKey}`;
          
          // Display the translated theme if available
          const displayText = currentLanguage === 'en' ? 
            themeItem.theme : 
            (themeItem.translatedTheme || themeItem.theme);
          
          return (
            <motion.div
              key={uniqueAnimationKey}
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
                animationsRef.current[uniqueAnimationKey] = definition;
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
