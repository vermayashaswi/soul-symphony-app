
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
  top?: number | string;
  left?: number | string;
  right?: number | string;
  transform?: string;
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
  const [position, setPosition] = useState<PositionState>({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
  const stepRef = useRef<HTMLDivElement>(null);
  
  // Calculate position based on target element with retry and enhanced logging
  useEffect(() => {
    // Function to calculate position with enhanced logging
    const calculatePosition = () => {
      if (step.id === 1) {
        // For step 1 - position the popup exactly in center of screen
        setPosition({
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        });
        console.log("Positioned step 1 popup in exact center of screen");
      } else if (step.id === 2) {
        // For step 2 - position the popup above the arrow button
        const arrowButton = document.querySelector('.journal-arrow-button');
        if (arrowButton) {
          const rect = arrowButton.getBoundingClientRect();
          console.log("Arrow button rect for step 2:", rect);
          
          // Position well above the arrow button
          setPosition({
            top: Math.max(rect.top - 250, 20), // At least 20px from top
            left: '50%', // Center horizontally using percentage
            right: undefined,
            transform: 'translateX(-50%)'
          });
          console.log("Positioned step 2 popup above arrow button at", {
            top: Math.max(rect.top - 250, 20),
            left: '50%'
          });
        } else {
          // Fallback if button not found
          setPosition({ top: 140, left: '50%', transform: 'translateX(-50%)' });
          console.log("Arrow button not found for step 2, using fallback position");
        }
      } else if (step.id === 3) {
        // For step 3 - find the record entry button with multiple selectors
        console.log("Calculating position for step 3...");
        
        // Try multiple selectors to find the element
        const selectors = [
          '.tutorial-record-entry-button',
          '[data-value="record"]',
          '.record-entry-tab',
          'button[data-tutorial-target="record-entry"]',
          '#new-entry-button'
        ];
        
        let recordEntryElement = null;
        let usedSelector = '';
        
        // Try each selector
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            recordEntryElement = element;
            usedSelector = selector;
            console.log(`Found step 3 target using selector: ${selector}`, element);
            break;
          }
        }
        
        if (recordEntryElement) {
          const rect = recordEntryElement.getBoundingClientRect();
          console.log(`Step 3 element rect using ${usedSelector}:`, rect);
          
          // Ensure the element is visible by adding tutorial classes
          recordEntryElement.classList.add('tutorial-target');
          recordEntryElement.classList.add('record-entry-tab');
          
          // Position below and centered with the element
          setPosition({
            top: rect.bottom + 20, // Below the element
            left: rect.left + (rect.width / 2),
            transform: 'translateX(-50%)'
          });
          console.log("Positioned step 3 popup at:", {
            top: rect.bottom + 20,
            left: rect.left + (rect.width / 2)
          });
        } else {
          console.warn("Could not find record entry element for step 3, using fallback position");
          // Fallback position - top center of screen
          setPosition({ 
            top: 120, 
            left: '50%', 
            transform: 'translateX(-50%)' 
          });
        }
      } else if (step.targetElement) {
        // Generic positioning for other steps
        const targetElement = document.querySelector(step.targetElement);
        
        if (targetElement) {
          const rect = targetElement.getBoundingClientRect();
          console.log(`Target element found for step ${step.id}:`, rect);
          
          // Add tutorial target class to ensure visibility
          targetElement.classList.add('tutorial-target');
          
          // Calculate position based on specified direction
          switch (step.position) {
            case 'top':
              setPosition({
                top: rect.top - (stepRef.current?.offsetHeight || 0) - 20,
                left: rect.left + rect.width / 2,
                transform: 'translateX(-50%)'
              });
              break;
            case 'bottom':
              setPosition({
                top: rect.bottom + 20,
                left: rect.left + rect.width / 2,
                transform: 'translateX(-50%)'
              });
              break;
            case 'left':
              setPosition({
                top: rect.top + rect.height / 2,
                left: rect.left - (stepRef.current?.offsetWidth || 0) - 20,
                transform: 'translateY(-50%)'
              });
              break;
            case 'right':
              setPosition({
                top: rect.top + rect.height / 2,
                left: rect.right + 20,
                transform: 'translateY(-50%)'
              });
              break;
            default:
              // Center over the element
              setPosition({
                top: rect.top + rect.height / 2,
                left: rect.left + rect.width / 2,
                transform: 'translate(-50%, -50%)'
              });
          }
        } else {
          console.warn(`Target element not found for step ${step.id}, using fallback position`);
          // Center in viewport if element not found
          setPosition({
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          });
        }
      } else {
        // Default center position for steps without target elements
        setPosition({
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        });
      }
    };
    
    // Run initial calculation
    calculatePosition();
    
    // Set up a secondary check after short delay to handle dynamic elements
    const secondaryCheck = setTimeout(calculatePosition, 300);
    
    return () => {
      clearTimeout(secondaryCheck);
      
      // Clean up any highlight classes when unmounting
      if (step.targetElement) {
        const targetElement = document.querySelector(step.targetElement);
        if (targetElement) {
          targetElement.classList.remove('tutorial-target');
        }
      }
      
      // Clean up step 3 specific elements
      if (step.id === 3) {
        const selectors = [
          '.tutorial-record-entry-button',
          '[data-value="record"]',
          '.record-entry-tab',
          'button[data-tutorial-target="record-entry"]',
          '#new-entry-button'
        ];
        
        selectors.forEach(selector => {
          const element = document.querySelector(selector);
          if (element) {
            element.classList.remove('tutorial-target', 'record-entry-tab');
          }
        });
      }
    };
  }, [step.id, step.targetElement, step.position]);
  
  // Handle navigation actions with stopPropagation to ensure they work
  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`Tutorial: Next button clicked for step ${step.id}`);
    onNext();
  };
  
  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`Tutorial: Previous button clicked for step ${step.id}`);
    onPrev();
  };
  
  const handleSkip = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Tutorial: Skip button clicked");
    onSkip();
  };
  
  // Apply all position styles directly
  const getPositionStyle = () => {
    return {
      top: position.top,
      left: position.left,
      right: position.right,
      transform: position.transform
    };
  };
  
  return (
    <motion.div
      ref={stepRef}
      className="absolute bg-card border border-theme shadow-lg rounded-xl p-4 z-[10000] max-w-[320px] tutorial-step-container"
      style={getPositionStyle()}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3 }}
      onClick={(e) => e.stopPropagation()} // Prevent clicks from reaching elements behind
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
          onClick={handleSkip}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Title */}
      <h3 className="text-lg font-semibold mb-1 text-foreground">{step.title}</h3>
      
      {/* Content */}
      <p className="text-sm text-muted-foreground mb-4">{step.content}</p>
      
      {/* Navigation buttons with enhanced z-index and click handling */}
      <div className="flex justify-between mt-2 tutorial-buttons">
        {!isFirst && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePrev}
            className="flex items-center gap-1 pointer-events-auto"
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
            onClick={handleNext}
            className="flex items-center gap-1 bg-theme hover:bg-theme/80 pointer-events-auto"
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
