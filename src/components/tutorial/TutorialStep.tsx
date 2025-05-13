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
  
  // Improved function to ensure the popup stays within viewport bounds
  const ensureWithinViewport = (pos: PositionState): PositionState => {
    const stepElement = stepRef.current;
    if (!stepElement) return pos;
    
    const padding = 20; // padding from viewport edges
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const elementHeight = stepElement.offsetHeight;
    const elementWidth = stepElement.offsetWidth;
    
    console.log('Viewport size:', { width: viewportWidth, height: viewportHeight });
    console.log('Element size:', { width: elementWidth, height: elementHeight });
    console.log('Original position:', pos);
    
    // Special handling for first step (Welcome) - always centered on screen
    if (step.id === 1) {
      console.log('Step 1 detected - forcing center positioning');
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }
    
    // Calculate numerical position values
    let topValue = typeof pos.top === 'string' ? 
      (pos.top.includes('%') ? 
        (parseFloat(pos.top) / 100) * viewportHeight : 
        parseFloat(pos.top)
      ) : pos.top || 0;
      
    let leftValue = typeof pos.left === 'string' ? 
      (pos.left.includes('%') ? 
        (parseFloat(pos.left) / 100) * viewportWidth : 
        parseFloat(pos.left)
      ) : pos.left || 0;
    
    // Adjust for transform if necessary
    if (pos.transform) {
      if (pos.transform.includes('translate(-50%, -50%)')) {
        topValue -= elementHeight / 2;
        leftValue -= elementWidth / 2;
      } else if (pos.transform.includes('translateX(-50%)')) {
        leftValue -= elementWidth / 2;
      } else if (pos.transform.includes('translateY(-50%)')) {
        topValue -= elementHeight / 2;
      }
    }
    
    // For mobile devices, steps 3 and 4 need special positioning
    const isMobile = viewportWidth < 640;
    const isStep3or4 = step.id === 3 || step.id === 4;
    
    // Make adjustments to keep within viewport
    const newPos = { ...pos };
    
    // Adjust top position
    if (topValue < padding) {
      // Force a minimum distance from top of screen
      newPos.top = padding;
      // Remove translateY from transform if present
      if (newPos.transform?.includes('translateY')) {
        newPos.transform = newPos.transform.replace(/translateY\([^)]+\)/, '');
      }
    } else if (topValue + elementHeight + padding > viewportHeight) {
      // Force a maximum from bottom of screen
      const newTop = viewportHeight - elementHeight - padding;
      newPos.top = newTop;
      
      // Remove translateY from transform if present
      if (newPos.transform?.includes('translateY')) {
        newPos.transform = newPos.transform.replace(/translateY\([^)]+\)/, '');
      }
    }
    
    // Special handling for step 3 and 4 on mobile
    if (isMobile && isStep3or4) {
      // For small screens, position at the center bottom area
      newPos.top = viewportHeight - elementHeight - padding * 2;
      newPos.left = viewportWidth / 2;
      newPos.transform = 'translateX(-50%)';
      
      // For extreme small screens, just center it
      if (newPos.top < padding * 4) {
        newPos.top = viewportHeight / 2;
        newPos.left = viewportWidth / 2;
        newPos.transform = 'translate(-50%, -50%)';
      }
    } 
    // Regular left position adjustment for all other cases
    else {
      // Adjust left position
      if (leftValue < padding) {
        newPos.left = padding;
        // Remove translateX from transform to avoid double adjustment
        if (newPos.transform?.includes('translateX')) {
          newPos.transform = newPos.transform.replace(/translateX\([^)]+\)/, '');
        }
      } else if (leftValue + elementWidth + padding > viewportWidth) {
        newPos.left = viewportWidth - elementWidth - padding;
        // Remove translateX from transform to avoid double adjustment
        if (newPos.transform?.includes('translateX')) {
          newPos.transform = newPos.transform.replace(/translateX\([^)]+\)/, '');
        }
      }
    }
    
    console.log('Adjusted position:', newPos);
    return newPos;
  };

  // Calculate position based on target element with retry and enhanced logging
  // Also ensure popup stays within viewport
  useEffect(() => {
    // Initial timeout to ensure components are fully rendered before positioning
    const initialTimeout = setTimeout(() => {
      // Function to calculate position with enhanced logging
      const calculatePosition = () => {
        // Always center Step 1 popup
        if (step.id === 1) {
          console.log("Positioning step 1 in exact center");
          // Add id for CSS targeting
          if (stepRef.current) {
            stepRef.current.id = 'tutorial-step-1-popup';
          }
          // Force center position for first popup regardless of entry point
          setPosition({
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          });
          return; // Skip other positioning for step 1
        } 
        // Handle step 2 positioning for arrow button
        else if (step.id === 2) {
          // For step 2 - position the popup above the arrow button but keep the button centered
          const arrowButton = document.querySelector('.journal-arrow-button');
          if (arrowButton) {
            const rect = arrowButton.getBoundingClientRect();
            console.log("Arrow button rect for step 2:", rect);
            
            // Position above the center without affecting button's position
            const calculatedPos = {
              top: Math.max(120, window.innerHeight * 0.25), // Position in top 25% of screen
              left: '50%', // Center horizontally
              right: undefined,
              transform: 'translateX(-50%)'
            };
            
            setPosition(ensureWithinViewport(calculatedPos));
            console.log("Positioned step 2 popup above arrow button");
            
            // Set ID for CSS targeting
            if (stepRef.current) {
              stepRef.current.id = 'tutorial-step-2-popup';
            }
          } else {
            // Fallback if button not found
            const fallbackPos = { top: 120, left: '50%', transform: 'translateX(-50%)' };
            setPosition(ensureWithinViewport(fallbackPos));
            console.log("Arrow button not found for step 2, using fallback position");
          }
        } 
        // Handle positioning for other steps with target elements
        else if (step.targetElement) {
          // Generic positioning for other steps with viewport boundary checks
          const targetElement = document.querySelector(step.targetElement);
          
          if (targetElement) {
            const rect = targetElement.getBoundingClientRect();
            console.log(`Target element found for step ${step.id}:`, rect);
            
            // Add tutorial target class to ensure visibility
            targetElement.classList.add('tutorial-target');
            
            // Add ID for CSS targeting
            if (stepRef.current) {
              stepRef.current.id = `tutorial-step-${step.id}-popup`;
            }
            
            // Calculate position based on specified direction
            let calculatedPos: PositionState = { top: 0, left: 0 };
            
            switch (step.position) {
              case 'top':
                calculatedPos = {
                  top: rect.top - (stepRef.current?.offsetHeight || 0) - 20,
                  left: rect.left + rect.width / 2,
                  transform: 'translateX(-50%)'
                };
                break;
              case 'bottom':
                calculatedPos = {
                  top: rect.bottom + 20,
                  left: rect.left + rect.width / 2,
                  transform: 'translateX(-50%)'
                };
                break;
              case 'left':
                calculatedPos = {
                  top: rect.top + rect.height / 2,
                  left: rect.left - (stepRef.current?.offsetWidth || 0) - 20,
                  transform: 'translateY(-50%)'
                };
                break;
              case 'right':
                calculatedPos = {
                  top: rect.top + rect.height / 2,
                  left: rect.right + 20,
                  transform: 'translateY(-50%)'
                };
                break;
              default:
                // Center over the element
                calculatedPos = {
                  top: rect.top + rect.height / 2,
                  left: rect.left + rect.width / 2,
                  transform: 'translate(-50%, -50%)'
                };
            }
            
            // Ensure the popup stays within viewport bounds
            setPosition(ensureWithinViewport(calculatedPos));
          } else {
            console.warn(`Target element not found for step ${step.id}, using fallback position`);
            // Center in viewport if element not found
            const fallbackPos = {
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            };
            
            setPosition(ensureWithinViewport(fallbackPos));
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
      
      // Secondary check to ensure positioning after everything has rendered
      const secondaryCheck = setTimeout(() => {
        calculatePosition();
        
        // Special handling for step 1 - always force center
        if (step.id === 1) {
          if (stepRef.current) {
            stepRef.current.style.position = 'fixed';
            stepRef.current.style.top = '50%';
            stepRef.current.style.left = '50%';
            stepRef.current.style.transform = 'translate(-50%, -50%)';
            stepRef.current.style.zIndex = '20000';
            stepRef.current.style.margin = '0';
            stepRef.current.style.maxWidth = '90%';
            stepRef.current.style.width = '320px';
          }
        }
      }, 300);
      
      return () => {
        clearTimeout(secondaryCheck);
      };
    }, 500); // Longer initial delay to ensure components are ready
    
    return () => {
      clearTimeout(initialTimeout);
      
      // Clean up any highlight classes when unmounting
      if (step.targetElement) {
        const targetElement = document.querySelector(step.targetElement);
        if (targetElement) {
          targetElement.classList.remove('tutorial-target');
        }
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
  
  // Fix: Define CSS properties with proper types for framer-motion
  const getPositionStyle = (): React.CSSProperties => {
    if (step.id === 1) {
      // Force center for first step
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 20000,
        margin: 0,
        maxWidth: '90%',
        width: '320px'
      };
    }
    
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
      id={`tutorial-step-${step.id}-popup`}
      className="absolute bg-card border border-theme shadow-lg rounded-xl p-4 z-[20000] max-w-[320px] tutorial-step-container"
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
