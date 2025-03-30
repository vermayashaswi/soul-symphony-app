
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

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
  // Increased font size for better readability
  const fontSizeStyle: React.CSSProperties = {
    fontSize: `${Math.max(12, size / 4)}px`, // Increased from 10, 4.5
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
      scale: [1, 1.03, 1],
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
        style={{ width: size, height: size }}
        initial={{ opacity: 0.9 }}
      >
        <span className="font-medium px-1 text-center" style={fontSizeStyle}>
          {name}
        </span>
      </motion.div>
    </div>
  );
};

export default EmotionBubbleDetail;
