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
  const [position, setPosition] = useState({ top: 0, left: 0 });
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
        let top = 0;
        let left = 0;
        
        switch (step.position) {
          case 'top':
            top = rect.top - (stepRef.current?.offsetHeight || 0) - 20;
            left = rect.left + rect.width / 2 - (stepRef.current?.offsetWidth || 0) / 2;
            break;
          case 'bottom':
            top = rect.bottom + 20;
            left = rect.left + rect.width / 2 - (stepRef.current?.offsetWidth || 0) / 2;
            break;
          case 'left':
            top = rect.top + rect.height / 2 - (stepRef.current?.offsetHeight || 0) / 2;
            left = rect.left - (stepRef.current?.offsetWidth || 0) - 20;
            break;
          case 'right':
            top = rect.top + rect.height / 2 - (stepRef.current?.offsetHeight || 0) / 2;
            left = rect.right + 20;
            break;
          default:
            // Center in viewport if no position specified
            top = window.innerHeight / 2 - (stepRef.current?.offsetHeight || 0) / 2;
            left = window.innerWidth / 2 - (stepRef.current?.offsetWidth || 0) / 2;
        }
        
        // Keep within viewport bounds
        top = Math.max(20, Math.min(top, window.innerHeight - (stepRef.current?.offsetHeight || 0) - 20));
        left = Math.max(20, Math.min(left, window.innerWidth - (stepRef.current?.offsetWidth || 0) - 20));
        
        setPosition({ top, left });
      }
    } else {
      // If no target element, center in viewport
      setPosition({
        top: window.innerHeight / 2 - (stepRef.current?.offsetHeight || 0) / 2,
        left: window.innerWidth / 2 - (stepRef.current?.offsetWidth || 0) / 2
      });
    }
  }, [step.targetElement, step.position]);
  
  // Calculate connector path if target element is specified
  useEffect(() => {
    if (targetRect && stepRef.current && step.targetElement) {
      const stepRect = stepRef.current.getBoundingClientRect();
      
      // Calculate center points
      const targetCenterX = targetRect.left + targetRect.width / 2;
      const targetCenterY = targetRect.top + targetRect.height / 2;
      const stepCenterX = stepRect.left + stepRect.width / 2;
      const stepCenterY = stepRect.top + stepRect.height / 2;
      
      // Create SVG path connecting the two elements
      setConnectorPath(`M${stepCenterX},${stepCenterY} L${targetCenterX},${targetCenterY}`);
    }
  }, [targetRect, step.targetElement, position]);
  
  return (
    <motion.div
      ref={stepRef}
      className="absolute bg-card border border-theme shadow-lg rounded-xl p-4 z-[9999] max-w-[320px]"
      style={{ top: position.top, left: position.left }}
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
            strokeWidth="2"
            fill="none"
            strokeDasharray="4"
            opacity="0.7"
          />
        </svg>
      )}
    </motion.div>
  );
};

export default TutorialStep;
