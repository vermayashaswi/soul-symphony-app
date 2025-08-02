
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';

interface EmotionBubbleDetailProps {
  name: string;
  size: number;
  color: string;
  isDisturbed?: boolean;
  isDragging?: boolean;
  isHighlighted?: boolean;
  percentage?: number;
  onClick: (emotion: string) => void;
}

const EmotionBubbleDetail: React.FC<EmotionBubbleDetailProps> = ({
  name,
  size,
  isDisturbed = false,
  isDragging = false,
  isHighlighted = false,
  onClick
}) => {
  // Font size is now constant, 2px smaller than the "Trend" text in Mood Calendar
  const fontSize = '14px';
  // Defensive hook usage to prevent runtime errors during app initialization
  let colorTheme = 'Default';
  
  try {
    const themeData = useTheme();
    colorTheme = themeData.colorTheme;
  } catch (error) {
    // ThemeProvider not ready, using defaults
  }
  
  return (
    <motion.div
      className={cn(
        "flex items-center justify-center w-full h-full rounded-full relative select-none bg-background/80 backdrop-blur-sm border border-border/50",
        isDragging ? "cursor-grabbing" : "cursor-pointer"
      )}
      onClick={() => onClick(name)}
      style={{
        backgroundColor: `hsl(var(--primary))`,
        color: `hsl(var(--primary-foreground))`
      }}
      animate={{
        scale: isHighlighted ? 1.1 : 1,
        boxShadow: isHighlighted 
          ? `0 0 20px 3px rgba(var(--theme-color-rgb), 0.5)` 
          : isDragging 
            ? `0 4px 8px rgba(0, 0, 0, 0.2)` 
            : `0 2px 4px rgba(0, 0, 0, 0.1)`
      }}
      transition={{ 
        duration: isDisturbed ? 0.2 : 0.3,
        ease: "easeOut" 
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <span 
        className="text-foreground font-medium"
        style={{ fontSize }}
      >
        {name}
      </span>
    </motion.div>
  );
};

export default EmotionBubbleDetail;
