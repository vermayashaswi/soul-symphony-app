
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/hooks/use-theme';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';

interface ThemeData {
  theme: string;
  sentiment: number;
}

interface FloatingThemeStripsProps {
  themesData: ThemeData[];
  themeColor: string;
}

const FloatingThemeStrips: React.FC<FloatingThemeStripsProps> = ({ 
  themesData,
  themeColor
}) => {
  const [uniqueThemes, setUniqueThemes] = useState<ThemeData[]>([]);
  const { theme } = useTheme();
  const { translate } = useTranslation();
  const [translatedLabel, setTranslatedLabel] = useState<string>("7-day themes");
  const isDarkMode = theme === 'dark';
  
  // Translate the label
  useEffect(() => {
    const translateLabel = async () => {
      if (translate) {
        const result = await translate("7-day themes", "en");
        setTranslatedLabel(result);
      }
    };
    
    translateLabel();
    
    // Listen for language changes
    const handleLanguageChange = async () => {
      if (translate) {
        const result = await translate("7-day themes", "en");
        setTranslatedLabel(result);
      }
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [translate]);
  
  useEffect(() => {
    if (themesData.length === 0) return;
    
    const themeMap = new Map<string, { count: number, sentiment: number }>();
    
    themesData.forEach(item => {
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
    
    const sortedThemes = Array.from(themeMap.entries())
      .map(([theme, { count, sentiment }]) => ({ theme, count, sentiment }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(({ theme, sentiment }) => ({ theme, sentiment }));
    
    setUniqueThemes(sortedThemes);
  }, [themesData]);

  if (!themesData.length) {
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
        {uniqueThemes.slice(0, 6).map((themeItem, index) => {
          const sectionHeight = 100 / Math.min(6, uniqueThemes.length);
          const randomOffset = Math.random() * 5 - 2.5;
          const yPosition = (index * sectionHeight) + (sectionHeight / 2) + randomOffset;
          
          const direction = index % 2 === 0;
          const speed = 15 + Math.random() * 10;
          
          return (
            <motion.div
              key={`theme-strip-${themeItem.theme}`}
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
                <TranslatableText text={themeItem.theme} sourceLanguage="en" />
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default FloatingThemeStrips;
