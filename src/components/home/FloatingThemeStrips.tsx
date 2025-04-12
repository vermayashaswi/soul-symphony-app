
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/hooks/use-theme';

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
  const isDarkMode = theme === 'dark';
  
  // Deduplicate themes and limit to 8 for better display
  useEffect(() => {
    if (themesData.length === 0) return;
    
    // Create a map to count occurrences and track highest sentiment
    const themeMap = new Map<string, { count: number, sentiment: number }>();
    
    themesData.forEach(item => {
      if (!themeMap.has(item.theme)) {
        themeMap.set(item.theme, { count: 1, sentiment: item.sentiment });
      } else {
        const existing = themeMap.get(item.theme)!;
        themeMap.set(item.theme, { 
          count: existing.count + 1,
          sentiment: (existing.sentiment + item.sentiment) / 2 // Average sentiment
        });
      }
    });
    
    // Convert map to array and sort by occurrence count
    const sortedThemes = Array.from(themeMap.entries())
      .map(([theme, { count, sentiment }]) => ({ theme, count, sentiment }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8) // Limit to top 8 themes
      .map(({ theme, sentiment }) => ({ theme, sentiment }));
    
    setUniqueThemes(sortedThemes);
  }, [themesData]);

  if (!themesData.length) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>No themes found in your recent journal entries</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Theme header strip */}
      <div className="absolute top-12 left-4 z-50">
        <div
          className="px-4 py-1.5 rounded-md"
          style={{
            backgroundColor: `${themeColor}30`, // 30% opacity
            borderLeft: `3px solid ${themeColor}`,
            borderRight: `3px solid ${themeColor}`,
            boxShadow: `0 0 1px 0 ${themeColor}40`,
            backdropFilter: 'blur(4px)',
          }}
        >
          <span 
            className="text-xs font-medium whitespace-nowrap"
            style={{
              color: themeColor,
              fontWeight: 500,
              letterSpacing: '0.01em',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale'
            }}
          >
            Themes - Your last 7 days
          </span>
        </div>
      </div>
      
      {/* Animation area restricted to between header and the quote component */}
      {/* Adjusted to prevent overlap with quote section by increasing bottom distance */}
      <div className="absolute inset-x-0 top-20 bottom-80 pointer-events-none">
        {uniqueThemes.slice(0, 6).map((themeItem, index) => {
          // Calculate vertical position using a more spread out distribution
          // Divide the container height into equal sections based on number of themes
          const sectionHeight = 100 / Math.min(6, uniqueThemes.length);
          // Place each strip in the center of its section with a small random offset
          const randomOffset = Math.random() * 5 - 2.5; // Random offset between -2.5% and 2.5%
          const yPosition = (index * sectionHeight) + (sectionHeight / 2) + randomOffset;
          
          const direction = index % 2 === 0; // Alternate direction
          const speed = 15 + Math.random() * 10; // Random speed between 15-25 seconds
          
          return (
            <motion.div
              key={`theme-strip-${themeItem.theme}`}
              className="absolute left-0 w-auto h-8 rounded-md px-3 py-1 flex items-center"
              style={{
                top: `${yPosition}%`,
                backgroundColor: `${themeColor}50`, // 50% opacity
                borderLeft: `3px solid ${themeColor}`,
                borderRight: `3px solid ${themeColor}`,
                boxShadow: `0 0 1px 0 ${themeColor}40`,
                backdropFilter: 'blur(4px)',
                zIndex: 15, // Below the buttons and indicators
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
                duration: speed, // Variable duration for full animation
                repeat: Infinity,
                repeatType: 'loop',
                ease: 'linear',
                delay: index * 2.5, // Stagger the animations
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
                {themeItem.theme}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default FloatingThemeStrips;
