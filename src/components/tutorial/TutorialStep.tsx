
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
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [connectorPath, setConnectorPath] = useState<string>('');
  
  // Calculate position based on target element (if specified)
  useEffect(() => {
    if (step.targetElement) {
      const targetElement = document.querySelector(step.targetElement);
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        setTargetRect(rect);
        
        // For step 2 - position popup in the top right corner
        if (step.id === 2) {
          // Higher position to leave more space
          setPosition({ top: 80, right: 20 });
          console.log("Positioning popup for step 2 in top right:", { top: 80, right: 20 });
        } else {
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
      }
    } else {
      // If no target element, center in viewport
      setPosition({
        top: window.innerHeight / 2 - (stepRef.current?.offsetHeight || 0) / 2,
        left: window.innerWidth / 2 - (stepRef.current?.offsetWidth || 0) / 2
      });
    }
  }, [step.targetElement, step.position, step.id]);
  
  // Calculate connector path with improved direct approach for step 2
  useEffect(() => {
    if (step.targetElement && step.id === 2) {
      const buttonElement = document.querySelector('.journal-arrow-button button');
      if (buttonElement && stepRef.current) {
        // Get accurate button position
        const buttonRect = buttonElement.getBoundingClientRect();
        const stepRect = stepRef.current.getBoundingClientRect();
        
        console.log('Button element rect:', buttonRect);
        console.log('Button element center:', {
          x: buttonRect.left + buttonRect.width / 2,
          y: buttonRect.top + buttonRect.height / 2
        });
        console.log('Step element rect:', stepRect);
        
        // Button center point
        const buttonCenterX = buttonRect.left + buttonRect.width / 2;
        const buttonCenterY = buttonRect.top + buttonRect.height / 2;
        
        // Starting point at the bottom of popup
        const startX = stepRect.left + 30; // Start from left side of popup
        const startY = stepRect.bottom; // Start from bottom of popup
        
        console.log('Connection points:', {
          start: { x: startX, y: startY },
          end: { x: buttonCenterX, y: buttonCenterY }
        });
        
        // Create a direct path from popup to button center
        const path = `M${startX},${startY} L${buttonCenterX},${buttonCenterY}`;
        
        console.log("Generated connector path:", path);
        setConnectorPath(path);
      } else {
        console.warn("Could not find button element for tutorial connector");
      }
    } else if (step.targetElement) {
      // Default connector logic for other steps
      const targetElement = document.querySelector(step.targetElement);
      if (targetElement && stepRef.current) {
        const targetRect = targetElement.getBoundingClientRect();
        const stepRect = stepRef.current.getBoundingClientRect();
        
        const targetCenterX = targetRect.left + targetRect.width / 2;
        const targetCenterY = targetRect.top + targetRect.height / 2;
        const stepCenterX = stepRect.left + stepRect.width / 2;
        const stepCenterY = stepRect.top + stepRect.height / 2;
        
        // Create SVG path connecting the two elements
        setConnectorPath(`M${stepCenterX},${stepCenterY} L${targetCenterX},${targetCenterY}`);
      }
    }
  }, [position, step.id, step.targetElement]);
  
  // Determine the style based on position
  const getPositionStyle = () => {
    const style: React.CSSProperties = { top: position.top };
    
    if (position.right !== undefined) {
      style.right = position.right;
    } else if (position.left !== undefined) {
      style.left = position.left;
    }
    
    // Set a smaller width for step 2 to make it more compact
    if (step.id === 2) {
      style.maxWidth = '220px';
      style.minWidth = '200px';
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
      
      {/* Direct connector line with improved z-index and visibility */}
      {connectorPath && (
        <svg 
          className="fixed top-0 left-0 w-screen h-screen pointer-events-none" 
          style={{ zIndex: 9990 }}
        >
          <path
            d={connectorPath}
            className={step.id === 2 ? "tutorial-direct-connector" : "tutorial-connector"}
          />
        </svg>
      )}
    </motion.div>
  );
};

export default TutorialStep;
