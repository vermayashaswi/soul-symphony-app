
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface EmotionBubbleDetailProps {
  name: string;
  size: number;
  color: string;
  className?: string;
  value?: number;
  onClick?: (name: string) => void;
  isDisturbed?: boolean;
}

const EmotionBubbleDetail: React.FC<EmotionBubbleDetailProps> = ({
  name,
  size,
  color,
  className,
  isDisturbed = false
}) => {
  const isMobile = useIsMobile();
  
  // Set a minimum font size to ensure legibility
  // Increased minimum size for better readability
  const fontSizeStyle: React.CSSProperties = {
    fontSize: `${Math.max(isMobile ? 14 : 16, size / 3)}px`, // Adjust minimum based on device
    lineHeight: '1.2',
    maxWidth: '90%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    wordBreak: 'break-word',
    textAlign: 'center' as const,
    height: '100%',
    padding: '12%',
    fontWeight: name.length <= 1 ? 'normal' : 'medium' // Only apply font-medium to actual words
  };

  // Set a minimum size for the bubble to ensure legibility
  // Increased minimum size for mobile
  const bubbleSize = Math.max(isMobile ? 60 : 70, size);

  // Create different animations based on disturbed state
  const getAnimation = () => {
    if (isDisturbed) {
      return {
        scale: [1, 1.1, 0.95, 1.05, 1],
        rotate: [0, 5, -5, 3, 0],
        transition: {
          duration: 1.5,
          ease: "easeInOut"
        }
      };
    }
    
    return {
      scale: [1, 1.03, 1, 0.97, 1],
      y: [0, -3, 0, 3, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }
    };
  };

  return (
    <div className="relative">
      <motion.div
        animate={getAnimation()}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "rounded-full flex items-center justify-center cursor-pointer shadow-sm transition-shadow relative",
          color,
          className
        )}
        style={{ width: bubbleSize, height: bubbleSize }}
        initial={{ opacity: 0.9 }}
        whileHover={{ 
          scale: 1.1, 
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
          transition: { duration: 0.2 }
        }}
      >
        <span className="font-medium px-1 text-center" style={fontSizeStyle}>
          {name}
        </span>
      </motion.div>
    </div>
  );
};

export default EmotionBubbleDetail;
