
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
        
        // Calculate position based on specified position and target element
        let newPosition: PositionState = { top: 0 };
        
        // For step 2 - special positioning in the top right corner
        if (step.id === 2) {
          newPosition = { top: 150, right: 20 };
          // Default to positioning in the top right
          setPosition(newPosition);
        } else {
          // Standard positioning logic
          switch (step.position) {
            case 'top':
              newPosition = {
                top: rect.top - (stepRef.current?.offsetHeight || 0) - 20,
                left: rect.left + rect.width / 2 - (stepRef.current?.offsetWidth || 0) / 2
              };
              break;
            case 'bottom':
              newPosition = {
                top: rect.bottom + 20,
                left: rect.left + rect.width / 2 - (stepRef.current?.offsetWidth || 0) / 2
              };
              break;
            case 'left':
              newPosition = {
                top: rect.top + rect.height / 2 - (stepRef.current?.offsetHeight || 0) / 2,
                left: rect.left - (stepRef.current?.offsetWidth || 0) - 20
              };
              break;
            case 'right':
              newPosition = {
                top: rect.top + rect.height / 2 - (stepRef.current?.offsetHeight || 0) / 2,
                left: rect.right + 20
              };
              break;
            default:
              // Center in viewport if no position specified
              newPosition = {
                top: window.innerHeight / 2 - (stepRef.current?.offsetHeight || 0) / 2,
                left: window.innerWidth / 2 - (stepRef.current?.offsetWidth || 0) / 2
              };
          }
          
          // Keep within viewport bounds
          newPosition.top = Math.max(20, Math.min(newPosition.top, window.innerHeight - (stepRef.current?.offsetHeight || 0) - 20));
          if (newPosition.left !== undefined) {
            newPosition.left = Math.max(20, Math.min(newPosition.left, window.innerWidth - (stepRef.current?.offsetWidth || 0) - 20));
          }
          
          setPosition(newPosition);
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
  
  // Calculate connector path if target element is specified
  useEffect(() => {
    if (targetRect && stepRef.current && step.targetElement) {
      const stepRect = stepRef.current.getBoundingClientRect();
      
      // For step 2, create a connector from popup to arrow button
      if (step.id === 2) {
        const targetElement = document.querySelector('.journal-arrow-button');
        if (targetElement) {
          // Get the updated target rectangle for the button
          const buttonRect = targetElement.getBoundingClientRect();
          
          // Button center coordinates
          const buttonCenterX = buttonRect.left + buttonRect.width / 2;
          const buttonCenterY = buttonRect.top + buttonRect.height / 2;
          
          // Starting point from the popup
          const startX = stepRect.right - 40; // Start from right side of popup
          const startY = stepRect.bottom - 10;
          
          // Create a curved path to the button
          const controlPointX = startX - 30;
          const controlPointY = buttonCenterY - 50;
          
          setConnectorPath(`M${startX},${startY} Q${controlPointX},${controlPointY} ${buttonCenterX},${buttonCenterY}`);
        } else {
          console.error("Arrow button element not found for tutorial connector");
        }
      } else {
        // Default connector logic
        const targetCenterX = targetRect.left + targetRect.width / 2;
        const targetCenterY = targetRect.top + targetRect.height / 2;
        const stepCenterX = stepRect.left + stepRect.width / 2;
        const stepCenterY = stepRect.top + stepRect.height / 2;
        
        // Create SVG path connecting the two elements
        setConnectorPath(`M${stepCenterX},${stepCenterY} L${targetCenterX},${targetCenterY}`);
      }
    }
  }, [targetRect, step.targetElement, position, step.id]);
  
  // Determine the style based on position
  const getPositionStyle = () => {
    const style: React.CSSProperties = { top: position.top };
    
    if (position.right !== undefined) {
      style.right = position.right;
    } else if (position.left !== undefined) {
      style.left = position.left;
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
      
      {/* Connector line */}
      {connectorPath && (
        <svg 
          className="absolute top-0 left-0 pointer-events-none z-[-1]" 
          style={{ width: '100vw', height: '100vh', position: 'fixed' }}
        >
          <path
            d={connectorPath}
            stroke="var(--color-theme)"
            strokeWidth="3"
            fill="none"
            strokeDasharray="6"
            opacity="1"
            className={step.id === 2 ? "tutorial-step-2-connector" : ""}
          />
        </svg>
      )}
    </motion.div>
  );
};

export default TutorialStep;
