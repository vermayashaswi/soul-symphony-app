
import React from 'react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
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
  const handleClick = () => {
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

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <motion.div
          animate={pulseAnimation}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "rounded-full flex items-center justify-center cursor-pointer shadow-sm transition-shadow",
            color,
            className
          )}
          style={{ width: size, height: size }}
          onClick={handleClick}
          initial={{ opacity: 0.9 }}
        >
          <span className="font-medium px-1 text-center" style={fontSizeStyle}>
            {name}
          </span>
        </motion.div>
      </HoverCardTrigger>
      <HoverCardContent className="p-4 backdrop-blur-sm bg-white/90 border-none shadow-lg w-48">
        <div className="space-y-2">
          <h4 className="font-semibold capitalize">{name}</h4>
          {value !== undefined && (
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Intensity</span>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-primary rounded-full"
                  style={{ width: '0%' }}
                  animate={{ 
                    width: `${Math.min(100, value * 100)}%` 
                  }}
                  transition={{ 
                    duration: 0.8, 
                    ease: "easeOut" 
                  }}
                ></motion.div>
              </div>
              <span className="text-xs text-right text-muted-foreground">
                {Math.round(value * 100)}%
              </span>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Click to explore this emotion further
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default EmotionBubbleDetail;
