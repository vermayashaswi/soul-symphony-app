
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

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
  color,
  isDisturbed = false,
  isDragging = false,
  isHighlighted = false,
  percentage,
  onClick
}) => {
  const fontSize = Math.max(size / 4.5, 12);
  const backgroundColorClass = color.split(' ')[0];
  const textColorClass = color.split(' ')[1];

  return (
    <motion.div
      className={cn(
        "flex items-center justify-center w-full h-full rounded-full relative select-none",
        backgroundColorClass,
        isDragging ? "cursor-grabbing" : "cursor-pointer"
      )}
      onClick={() => onClick(name)}
      style={{ fontSize: `${fontSize}px` }}
      animate={{
        scale: isHighlighted ? 1.1 : 1,
        boxShadow: isHighlighted 
          ? `0 0 20px 3px rgba(139, 92, 246, 0.5)` 
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
      <span className={cn(
        textColorClass,
        "font-medium text-center truncate px-2",
        isHighlighted ? "font-bold" : ""
      )}>
        {name}
      </span>
    </motion.div>
  );
};

export default EmotionBubbleDetail;
