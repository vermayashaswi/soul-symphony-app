
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Tag, Bookmark, BookMarked, Hash, Star, Sparkles } from 'lucide-react';

interface ThemeBoxesProps {
  themes: string[];
  entryId?: number;
  sourceLanguage?: string;
}

// Define a list of vibrant colors that work well in both light and dark modes
const themeColors = [
  'bg-[#E5DEFF] text-[#6E59A5] hover:bg-[#D3CAFF] border-[#9b87f5]', // Soft Purple
  'bg-[#FDE1D3] text-[#F97316] hover:bg-[#FFCBB0] border-[#FEC6A1]', // Soft Peach
  'bg-[#F2FCE2] text-[#4ADE80] hover:bg-[#E3F8CD] border-[#B6F09C]', // Soft Green
  'bg-[#D3E4FD] text-[#0EA5E9] hover:bg-[#BFDBFF] border-[#93C5FD]', // Soft Blue
  'bg-[#FEF7CD] text-[#EAB308] hover:bg-[#FFF0A3] border-[#FDE68A]', // Soft Yellow
  'bg-[#FFDEE2] text-[#EC4899] hover:bg-[#FFCCD3] border-[#F9A8D4]', // Soft Pink
];

// Define icons to be used with common theme categories
const themeIcons: Record<string, React.ReactNode> = {
  family: <Tag size={12} className="mr-1" />,
  work: <BookMarked size={12} className="mr-1" />,
  love: <Star size={12} className="mr-1" />,
  health: <Sparkles size={12} className="mr-1" />,
  travel: <Bookmark size={12} className="mr-1" />,
};

// Function to consistently assign the same color to the same theme
const getThemeColorClass = (theme: string): string => {
  // Generate a simple hash from the theme string to get a consistent index
  const hash = theme.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorIndex = hash % themeColors.length;
  return themeColors[colorIndex];
};

// Function to get an appropriate icon based on theme content
const getThemeIcon = (theme: string): React.ReactNode => {
  // Check if the theme contains any of our predefined categories
  const lowercaseTheme = theme.toLowerCase();
  for (const [category, icon] of Object.entries(themeIcons)) {
    if (lowercaseTheme.includes(category)) {
      return icon;
    }
  }
  // Default icon if no match
  return <Hash size={12} className="mr-1" />;
};

export function ThemeBoxes({ themes = [], entryId, sourceLanguage }: ThemeBoxesProps) {
  // Ensure we have valid themes
  const validThemes = themes
    .filter(theme => theme && typeof theme === 'string' && theme.trim() !== '')
    .slice(0, 8); // Limit to 8 themes for UI cleanliness
  
  return (
    <div className="flex flex-wrap gap-1.5">
      {validThemes.map((theme, index) => {
        const colorClass = getThemeColorClass(theme);
        const themeIcon = getThemeIcon(theme);
        
        return (
          <Badge 
            key={`${theme}-${index}`}
            variant="outline"
            className={`text-xs font-medium border px-2 py-1 rounded-lg transition-all 
                      hover:scale-105 duration-200 animate-fade-in flex items-center
                      ${colorClass}`}
          >
            {themeIcon}
            <TranslatableText 
              text={theme} 
              sourceLanguage={sourceLanguage}
              entryId={entryId}
            />
          </Badge>
        );
      })}
    </div>
  );
}

export default ThemeBoxes;
