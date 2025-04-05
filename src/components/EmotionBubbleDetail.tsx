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
  isDragging?: boolean;
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
  isHighlighted = false,
  isDragging = false
}) => {
  const isMobile = useIsMobile();
  const [showPercentage, setShowPercentage] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (isHighlighted) {
      setShowPercentage(true);
    }
  }, [isHighlighted]);
  
  useEffect(() => {
    if (showPercentage && !isHighlighted) {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = window.setTimeout(() => {
        setShowPercentage(false);
      }, 1000);
    }
    
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [showPercentage, isHighlighted]);

  const calculateFontSize = () => {
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
    
    if (size < 50) {
      baseSize = baseSize * 0.8;
    }
    
    const minSize = isMobile ? 10 : 12;
    const maxSize = isMobile ? 16 : 20;
    
    return Math.min(maxSize, Math.max(minSize, baseSize));
  };
  
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

  const bubbleSize = Math.max(isMobile ? 40 : 50, size);

  const getAnimation = () => {
    if (isDragging) {
      return {};
    } else if (isDisturbed) {
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
    setShowPercentage(true);
    
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
          isDragging ? "shadow-lg z-50" : "",
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
        
        {(showPercentage || isHighlighted) && percentage !== undefined && (
          <motion.div 
            className="absolute -top-8 bg-background border border-border shadow-md px-2 py-1 rounded-md text-xs font-semibold z-10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            {(Math.round(percentage * 10) / 10).toFixed(1)}%
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default EmotionBubbleDetail;
