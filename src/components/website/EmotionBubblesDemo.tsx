
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';

// Demo component that shows floating emotion bubbles with equal sizes but varying color intensities
const EmotionBubblesDemo = ({ isPhonePreview = false }) => {
  // Define emotions with their percentages
  const emotions = [
    { name: "Joy", percentage: 40 },
    { name: "Calm", percentage: 25 },
    { name: "Hope", percentage: 20 },
    { name: "Focus", percentage: 10 },
    { name: "Inspired", percentage: 5 }
  ];

  const [selectedBubble, setSelectedBubble] = useState<number | null>(null);
  const { colorTheme, theme } = useTheme();
  const isMobile = useIsMobile();

  // Calculate the available area (using 70% of the container)
  const containerWidth = 100; // Percentage units
  const containerHeight = 100; // Percentage units
  const availableArea = containerWidth * containerHeight * 0.7;
  
  // Calculate bubble size
  const numberOfBubbles = emotions.length;
  const areaPerBubble = availableArea / numberOfBubbles;
  const bubbleRadius = Math.sqrt(areaPerBubble / Math.PI);
  
  // Adjust size based on if this is in the phone preview
  const bubbleSize = isPhonePreview 
    ? Math.min(28, bubbleRadius * 0.7) // Larger for phone preview
    : Math.min(30, bubbleRadius * 0.4); // Normal size otherwise

  const handleBubbleClick = (index: number) => {
    if (selectedBubble === index) {
      setSelectedBubble(null);
    } else {
      setSelectedBubble(index);
    }
  };

  // Get the base color from the theme
  const baseColor = '#8b5cf6'; // Default purple if theme color isn't available

  return (
    <div className="w-full h-full relative">
      {/* Info text about color intensity - hide in phone preview */}
      {!isPhonePreview && (
        <div className="absolute top-1 right-1 text-xs text-muted-foreground">
          * Darker colors represent higher scores of emotion
        </div>
      )}
      
      {/* Percentage display when a bubble is selected */}
      {selectedBubble !== null && !isPhonePreview && (
        <motion.div 
          className="absolute top-1 right-12 bg-background border border-border shadow-md px-2 py-1 rounded-md text-sm font-semibold z-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
        >
          {emotions[selectedBubble].percentage}%
        </motion.div>
      )}
      
      {emotions.map((emotion, index) => {
        // Calculate opacity based on percentage (higher percentage = more opaque/darker)
        // Using a scale that ensures even low percentages are still visible
        const minOpacity = 0.4; // Increased minimum opacity for better visibility
        const maxPercentage = Math.max(...emotions.map(e => e.percentage));
        const opacity = minOpacity + ((1 - minOpacity) * (emotion.percentage / maxPercentage));
        
        // Adjusted positions for the phone preview
        const topPosition = isPhonePreview
          ? `${15 + (index * 8) % 30}px`  // More compact vertical distribution
          : `${25 + Math.sin(index * 1.5) * 15}px`;
        
        const leftPosition = isPhonePreview
          ? `${10 + (index * 18) % 80}%`  // More spread out horizontal distribution
          : `${(index * 16) % 95}%`;
        
        // Faster animation for phone preview
        const animationDuration = isPhonePreview ? 2 + index : 4 + index;
        
        // Stronger boxShadow for phone preview
        const shadowIntensity = isPhonePreview ? '0 0 15px' : '0 0 10px';
        
        return (
          <motion.div
            key={index}
            className={`absolute rounded-full flex items-center justify-center cursor-pointer emotion-bubble-container ${
              isPhonePreview ? 'text-white font-bold' : 'text-white font-bold'
            }`}
            style={{
              backgroundColor: baseColor,
              width: `${bubbleSize}px`,
              height: `${bubbleSize}px`,
              fontSize: isPhonePreview ? `${bubbleSize / 3.5}px` : `${bubbleSize / 4}px`,
              top: topPosition,
              left: leftPosition,
              opacity: opacity,
              boxShadow: `${shadowIntensity} ${baseColor}${isPhonePreview ? 'cc' : '80'}`,
              WebkitBackfaceVisibility: 'hidden', // iOS GPU rendering optimization
              WebkitTransform: 'translateZ(0)', // iOS GPU rendering optimization
              WebkitPerspective: '1000', // iOS GPU rendering optimization
              zIndex: isPhonePreview ? 5 : 'auto',
            }}
            animate={{
              y: [0, -5, 0, 5, 0],
              scale: [1, 1.05, 1, 0.95, 1]
            }}
            whileTap={{ 
              scale: 1.1,
              transition: { duration: 0.2 } 
            }}
            onClick={() => handleBubbleClick(index)}
            // Faster animation for phone preview
            transition={{
              duration: animationDuration,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {emotion.name}
          </motion.div>
        );
      })}
    </div>
  );
};

export default EmotionBubblesDemo;
