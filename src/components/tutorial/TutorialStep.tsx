
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
  const stepRef = useRef<HTMLDivElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const [renderKey] = useState(Date.now());
  
  // Improved logging for debugging
  useEffect(() => {
    console.log(`TutorialStep mounted for step ${step.id}, renderKey: ${renderKey}`);
    
    return () => {
      console.log(`TutorialStep unmounted for step ${step.id}`);
    };
  }, [step.id, renderKey]);
  
  // Simplified button click handlers with improved event handling
  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log(`Next button clicked for step ${step.id}`);
    onNext();
  };
  
  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log(`Previous button clicked for step ${step.id}`);
    onPrev();
  };
  
  const handleSkip = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log(`Skip button clicked for step ${step.id}`);
    onSkip();
  };
  
  // Add direct DOM click handler backup
  useEffect(() => {
    if (nextButtonRef.current) {
      const handleDirectClick = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`Direct DOM click handler fired for step ${step.id}`);
        onNext();
      };
      
      nextButtonRef.current.addEventListener('click', handleDirectClick, { capture: true });
      
      return () => {
        if (nextButtonRef.current) {
          nextButtonRef.current.removeEventListener('click', handleDirectClick, { capture: true });
        }
      };
    }
  }, [onNext, step.id]);
  
  // Updated positioning style to place all popups near the top of the screen
  const getPositionStyle = () => {
    // Base positioning at top of screen for all steps
    const baseStyle = {
      top: '80px',  // Position near the top of the screen (with some spacing)
      left: '50%',
      transform: 'translate(-50%, 0)', // Only transform X axis to center horizontally
      position: 'fixed' as const
    };
    
    // Responsive adjustments for smaller screens
    if (window.innerWidth <= 640) {
      return {
        ...baseStyle,
        top: '60px', // Less spacing on mobile devices
      };
    }
    
    // Additional adjustments for very small screens
    if (window.innerWidth <= 360) {
      return {
        ...baseStyle,
        top: '40px', // Even less spacing on very small devices
      };
    }
    
    return baseStyle;
  };
  
  return (
    <motion.div
      ref={stepRef}
      className="tutorial-step-container bg-card border border-theme shadow-lg rounded-xl p-4 max-w-[320px]"
      style={{
        ...getPositionStyle(),
        backgroundColor: '#1A1F2C', // Dark background for all steps
        color: 'white',             // White text for all steps
        border: '3px solid var(--color-theme)',
        boxShadow: '0 0 30px rgba(0, 0, 0, 0.7)',
        zIndex: 30000, // Consistently high z-index for all steps
        pointerEvents: 'auto'
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3 }}
      onClick={(e) => e.stopPropagation()} // Prevent clicks from reaching elements behind
      data-step={step.id} // Add data attribute for easier CSS targeting
      key={`step-${step.id}-${renderKey}`} // Add render key for stability
    >
      {/* Step indicator */}
      <div className="flex justify-between items-center mb-2">
        <div className="bg-theme text-white text-xs px-2 py-1 rounded-md">
          Step {stepNumber} of {totalSteps}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0 text-white hover:text-white/90" 
          onClick={handleSkip}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Title */}
      <h3 className="text-lg font-semibold mb-1 text-white">{step.title}</h3>
      
      {/* Content */}
      <p className="text-sm text-white/80 mb-4">{step.content}</p>
      
      {/* Navigation buttons with enhanced click handling and improved back button contrast */}
      <div className="flex justify-between mt-2 tutorial-buttons">
        {!isFirst && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePrev}
            className="flex items-center gap-1 pointer-events-auto bg-gray-800 border-white/50 text-white hover:text-white hover:bg-gray-700"
            style={{
              color: "#FFFFFF !important", // Ensure text is visible in light mode
              backgroundColor: "#333333",  // Dark background for back button
              borderColor: "rgba(255,255,255,0.5)"
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        )}
        
        <div className="flex-1"></div>
        
        {step.showNextButton && (
          <Button 
            ref={nextButtonRef}
            variant="default" 
            size="sm" 
            onClick={handleNext}
            className="flex items-center gap-1 bg-theme hover:bg-theme/80 pointer-events-auto z-50"
            data-testid="tutorial-next-button"
            style={{ cursor: 'pointer', position: 'relative', zIndex: 30001 }}
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
