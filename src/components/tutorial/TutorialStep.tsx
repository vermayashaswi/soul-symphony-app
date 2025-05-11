
import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import { TutorialStep as TutorialStepType } from '@/contexts/TutorialContext';

interface TutorialStepProps {
  step: TutorialStepType;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  isFirst: boolean;
  isLast: boolean;
  stepNumber: number;
  totalSteps: number;
}

interface PositionState {
  top: number;
  left?: number;
  right?: number;
}

const TutorialStep: React.FC<TutorialStepProps> = ({
  step,
  onNext,
  onPrev,
  onSkip,
  isFirst,
  isLast,
  stepNumber,
  totalSteps
}) => {
  const [position, setPosition] = useState<PositionState>({ top: 20, right: 20 });
  const stepRef = useRef<HTMLDivElement>(null);
  
  // Calculate position based on target element (if specified)
  useEffect(() => {
    if (step.id === 2) {
      // For step 2 - position the popup above the arrow button in the center
      const arrowButton = document.querySelector('.journal-arrow-button');
      if (arrowButton) {
        const rect = arrowButton.getBoundingClientRect();
        // Position above the arrow button
        setPosition({
          top: rect.top - 170, // Position above the button with some margin
          left: '50%',
          right: undefined
        });
        console.log("Positioning popup for step 2 above arrow button:", { 
          top: rect.top - 170,
          left: '50%'
        });
      } else {
        // Fallback if button not found
        setPosition({ top: 140, left: '50%' });
        console.log("Arrow button not found, using fallback position");
      }
    } else if (step.targetElement) {
      const targetElement = document.querySelector(step.targetElement);
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        
        // Standard positioning logic for other steps
        switch (step.position) {
          case 'top':
            setPosition({
              top: rect.top - (stepRef.current?.offsetHeight || 0) - 20,
              left: rect.left + rect.width / 2 - (stepRef.current?.offsetWidth || 0) / 2
            });
            break;
          case 'bottom':
            setPosition({
              top: rect.bottom + 20,
              left: rect.left + rect.width / 2 - (stepRef.current?.offsetWidth || 0) / 2
            });
            break;
          case 'left':
            setPosition({
              top: rect.top + rect.height / 2 - (stepRef.current?.offsetHeight || 0) / 2,
              left: rect.left - (stepRef.current?.offsetWidth || 0) - 20
            });
            break;
          case 'right':
            setPosition({
              top: rect.top + rect.height / 2 - (stepRef.current?.offsetHeight || 0) / 2,
              left: rect.right + 20
            });
            break;
          default:
            // Center in viewport if no position specified
            setPosition({
              top: window.innerHeight / 2 - (stepRef.current?.offsetHeight || 0) / 2,
              left: window.innerWidth / 2 - (stepRef.current?.offsetWidth || 0) / 2
            });
        }
      }
    } else {
      // If no target element, center in viewport
      setPosition({
        top: window.innerHeight / 2 - (stepRef.current?.offsetHeight || 0) / 2,
        left: window.innerWidth / 2 - (stepRef.current?.offsetWidth || 0) / 2
      });
    }
  }, [step.targetElement, step.position, step.id]);
  
  // Determine the style based on position
  const getPositionStyle = () => {
    const style: React.CSSProperties = { 
      top: position.top,
      transform: step.id === 2 ? 'translateX(-50%)' : undefined // Center horizontally for step 2
    };
    
    if (position.right !== undefined) {
      style.right = position.right;
    } else if (position.left !== undefined) {
      style.left = position.left;
    }
    
    // Set a smaller width for step 2 to make it more compact
    if (step.id === 2) {
      style.maxWidth = '280px';
      style.minWidth = '240px';
    }
    
    return style;
  };
  
  return (
    <motion.div
      ref={stepRef}
      className="absolute bg-card border border-theme shadow-lg rounded-xl p-4 z-[9999] max-w-[320px]"
      style={getPositionStyle()}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3 }}
    >
      {/* Step indicator */}
      <div className="flex justify-between items-center mb-2">
        <div className="bg-theme text-white text-xs px-2 py-1 rounded-md">
          Step {stepNumber} of {totalSteps}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0" 
          onClick={onSkip}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Title */}
      <h3 className="text-lg font-semibold mb-1 text-foreground">{step.title}</h3>
      
      {/* Content */}
      <p className="text-sm text-muted-foreground mb-4">{step.content}</p>
      
      {/* Navigation buttons */}
      <div className="flex justify-between mt-2">
        {!isFirst && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onPrev}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        )}
        
        <div className="flex-1"></div>
        
        {step.showNextButton && (
          <Button 
            variant="default" 
            size="sm" 
            onClick={onNext}
            className="flex items-center gap-1 bg-theme hover:bg-theme/80"
          >
            {isLast ? 'Finish' : 'Next'}
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default TutorialStep;
