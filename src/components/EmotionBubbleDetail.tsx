
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface EmotionBubbleDetailProps {
  name: string;
  size: number;
  color: string;
  className?: string;
  value?: number;
  onClick?: (name: string) => void;
}

const EmotionBubbleDetail: React.FC<EmotionBubbleDetailProps> = ({
  name,
  size,
  color,
  className,
  value,
  onClick,
}) => {
  const [isSelected, setIsSelected] = useState(false);

  const handleClick = () => {
    setIsSelected(!isSelected);
    if (onClick) {
      onClick(name);
    }
  };

  const fontSizeStyle: React.CSSProperties = {
    fontSize: `${Math.max(10, size / 4.5)}px`,
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
    padding: '12%'
  };

  // Create a pulsing animation
  const pulseAnimation = {
    scale: [1, 1.03, 1],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    }
  };

  // Enhanced glow animation when selected
  const selectedAnimation = isSelected ? {
    boxShadow: [
      `0 0 10px 2px rgba(255, 255, 255, 0.7)`,
      `0 0 20px 5px rgba(255, 255, 255, 0.8)`,
      `0 0 10px 2px rgba(255, 255, 255, 0.7)`
    ],
    transition: {
      boxShadow: {
        duration: 1.5,
        repeat: Infinity,
        repeatType: "reverse" as const
      }
    }
  } : {};

  return (
    <div className="relative">
      <motion.div
        animate={{
          ...pulseAnimation,
          ...selectedAnimation
        }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "rounded-full flex items-center justify-center cursor-pointer shadow-sm transition-shadow relative",
          color,
          className,
          isSelected && "z-10"
        )}
        style={{ width: size, height: size }}
        onClick={handleClick}
        initial={{ opacity: 0.9 }}
      >
        <span className="font-medium px-1 text-center" style={fontSizeStyle}>
          {name}
        </span>

        {/* Intensity indicator that appears when selected */}
        {isSelected && value !== undefined && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-4 -right-2 bg-white text-primary font-medium text-xs px-2 py-1 rounded-full shadow-md"
          >
            {Math.round(value * 100)}%
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default EmotionBubbleDetail;
