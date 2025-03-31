
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface EmotionBubbleDetailProps {
  name: string;
  size: number;
  color: string;
  className?: string;
  value?: number;
  percentage?: number;
  onClick?: (name: string) => void;
  isDisturbed?: boolean;
  isHighlighted?: boolean;
}

const EmotionBubbleDetail: React.FC<EmotionBubbleDetailProps> = ({
  name,
  size,
  color,
  className,
  value,
  percentage,
  onClick,
  isDisturbed = false,
  isHighlighted = false
}) => {
  const isMobile = useIsMobile();
  const [showPercentage, setShowPercentage] = useState(false);
  
  useEffect(() => {
    if (isHighlighted) {
      setShowPercentage(true);
      const timer = setTimeout(() => {
        setShowPercentage(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isHighlighted]);

  // Calculate text size based on bubble size and device
  const calculateFontSize = () => {
    // Base size adjustments for different text lengths
    let baseSize;
    
    if (name.length <= 3) {
      baseSize = size / 3.5;
    } else if (name.length <= 6) {
      baseSize = size / 4;
    } else if (name.length <= 10) {
      baseSize = size / 5;
    } else {
      baseSize = size / 6;
    }
    
    // Ensure minimum and maximum font sizes based on device
    const minSize = isMobile ? 11 : 13;
    const maxSize = isMobile ? 18 : 22;
    
    return Math.min(maxSize, Math.max(minSize, baseSize));
  };
  
  // Set font size style
  const fontSizeStyle: React.CSSProperties = {
    fontSize: `${calculateFontSize()}px`,
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
    fontWeight: name.length <= 1 ? 'normal' : 'medium'
  };

  // Set a minimum size for the bubble to ensure legibility
  const bubbleSize = Math.max(isMobile ? 45 : 60, size);

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

  const handleBubbleClick = () => {
    if (onClick && name && name !== '•') {
      onClick(name);
    }
  };

  return (
    <div className="relative">
      <motion.div
        animate={getAnimation()}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "rounded-full flex items-center justify-center cursor-pointer shadow-sm transition-shadow relative",
          color,
          isHighlighted ? "ring-4 ring-primary ring-opacity-70" : "",
          className
        )}
        style={{ width: bubbleSize, height: bubbleSize }}
        initial={{ opacity: 0.9 }}
        whileHover={{ 
          scale: 1.1, 
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
          transition: { duration: 0.2 }
        }}
        onClick={handleBubbleClick}
      >
        <span className="font-medium px-1 text-center" style={fontSizeStyle}>
          {name}
        </span>
        
        {showPercentage && percentage !== undefined && (
          <motion.div 
            className="absolute -top-8 bg-background border border-border shadow-md px-2 py-1 rounded-md text-xs font-semibold z-10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            {percentage.toFixed(1)}%
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default EmotionBubbleDetail;
