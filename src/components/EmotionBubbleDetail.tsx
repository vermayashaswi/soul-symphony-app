
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

  const fontSizeStyle = {
    fontSize: `${Math.max(10, size / 4.5)}px`,
    lineHeight: '1.2',
    maxWidth: '90%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    wordBreak: 'break-word',
    textAlign: 'center',
    height: '100%',
    padding: '12%'
  };

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "rounded-full flex items-center justify-center cursor-pointer",
            color,
            className
          )}
          style={{ width: size, height: size }}
          onClick={handleClick}
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
                <div 
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${Math.min(100, value * 100)}%` }}
                ></div>
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
