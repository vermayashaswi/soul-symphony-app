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
    
    // Special handling for step 1
    const isStep1 = step.id === 1;
    if (isStep1 && (isMobile || viewportHeight < 600)) {
      // For step 1 on mobile or small height screens, center it regardless of calculations
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }
    
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
    
    // Special handling for step 3 and 4 on mobile - IMPROVED POSITIONING
    if (isMobile && isStep3or4) {
      // Position in center of screen for better visibility on all devices
      newPos.top = '50%';
      newPos.left = '50%';
      newPos.transform = 'translate(-50%, -50%)';
      console.log('Mobile device detected for step 3/4, forcing center position');
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
    
    // Final check for very small screens - prioritize visibility over precise positioning
    if (viewportWidth < 360 || viewportHeight < 500) {
      // For very small screens, just center everything
      console.log('Very small screen detected, centering popup');
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }
    
    console.log('Adjusted position:', newPos);
    return newPos;
  };

  // Calculate position based on target element with retry and enhanced logging
  // Also ensure popup stays within viewport
  useEffect(() => {
    // Function to calculate position with enhanced logging
    const calculatePosition = () => {
      // Special case for step 1 on small screens - always center
      if (step.id === 1 && window.innerWidth < 480) {
        setPosition({
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        });
        console.log("Small screen detected, positioning step 1 popup in exact center");
        return;
      }
      
      // Handle step 1 positioning
      if (step.id === 1) {
        // For step 1 - position the popup exactly in center of screen
        setPosition({
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        });
        console.log("Positioned step 1 popup in exact center of screen");
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
          console.log("Positioned step 2 popup above arrow button without affecting button position");
        } else {
          // Fallback if button not found
          const fallbackPos = { top: 120, left: '50%', transform: 'translateX(-50%)' };
          setPosition(ensureWithinViewport(fallbackPos));
          console.log("Arrow button not found for step 2, using fallback position");
        }
      } 
      // Handle step 3 positioning for record entry button - IMPROVED FOR VISIBILITY
      else if (step.id === 3) {
        console.log("Calculating position for step 3...");
        
        // For step 3 - use center positioning for maximum visibility on all devices
        const centeredPos = {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        };
        
        setPosition(centeredPos);
        console.log("Positioned step 3 popup at center of screen for maximum visibility");
        
        // Try to find the record entry button for highlighting only
        const selectors = [
          '.tutorial-record-entry-button',
          '[data-value="record"]',
          '.record-entry-tab',
          'button[data-tutorial-target="record-entry"]',
          '#new-entry-button'
        ];
        
        let recordEntryElement = null;
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            recordEntryElement = element;
            console.log(`Found step 3 target using selector: ${selector}`, element);
            
            // Ensure the element is visible by adding tutorial classes
            recordEntryElement.classList.add('tutorial-target');
            recordEntryElement.classList.add('record-entry-tab');
            break;
          }
        }
        
        if (!recordEntryElement) {
          console.warn("Could not find record entry element for step 3, but popup is still centered");
        }
      } 
      // Handle step 4 positioning for past entries tab - ALSO IMPROVED FOR VISIBILITY
      else if (step.id === 4) {
        console.log("Calculating position for step 4...");
        
        // For step 4 - also use center positioning for consistency with step 3
        const centeredPos = {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        };
        
        setPosition(centeredPos);
        console.log("Positioned step 4 popup at center of screen for maximum visibility");
        
        // Try to find the past entries tab for highlighting only
        const selectors = [
          '[value="entries"]',
          '.entries-tab',
          'button[data-tutorial-target="past-entries"]',
          '#past-entries-button'
        ];
        
        let entriesTabElement = null;
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            entriesTabElement = element;
            console.log(`Found step 4 target using selector: ${selector}`, element);
            
            // Add tutorial target class to ensure visibility
            entriesTabElement.classList.add('tutorial-target');
            entriesTabElement.classList.add('entries-tab');
            break;
          }
        }
        
        if (!entriesTabElement) {
          console.warn("Could not find Past Entries tab for step 4, but popup is still centered");
        }
      } 
      // Handle generic positioning for other steps
      else if (step.targetElement) {
        // Generic positioning for other steps with viewport boundary checks
        const targetElement = document.querySelector(step.targetElement);
        
        if (targetElement) {
          const rect = targetElement.getBoundingClientRect();
          console.log(`Target element found for step ${step.id}:`, rect);
          
          // Add tutorial target class to ensure visibility
          targetElement.classList.add('tutorial-target');
          
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
      
      // Additional check for viewport bounds after all positioning is done
      if (stepRef.current) {
        setTimeout(() => {
          const currentPos = { ...position };
          const adjustedPos = ensureWithinViewport(currentPos);
          
          // Only update if there are changes needed
          if (JSON.stringify(currentPos) !== JSON.stringify(adjustedPos)) {
            console.log("Final position adjustment to ensure within viewport:", adjustedPos);
            setPosition(adjustedPos);
          }
        }, 50);
      }
    };
    
    // Run initial calculation
    calculatePosition();
    
    // Set up a secondary check after short delay to handle dynamic elements
    const secondaryCheck = setTimeout(calculatePosition, 300);
    
    // Add a tertiary check for visibility
    const tertiaryCheck = setTimeout(() => {
      // Force centered position for steps 3 and 4 for maximum visibility
      if (step.id === 3 || step.id === 4) {
        console.log(`Performing final position check for step ${step.id}`);
        setPosition({
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        });
      }
      
      // Final check specifically for step 1 on small screens
      if (step.id === 1 && window.innerWidth < 480) {
        console.log("Final position check for step 1 on small screens");
        // Force centered positioning
        setPosition({
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        });
      }
    }, 500);
    
    return () => {
      clearTimeout(secondaryCheck);
      clearTimeout(tertiaryCheck);
      
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
      
      // Clean up step 4 specific elements
      if (step.id === 4) {
        const selectors = [
          '[value="entries"]',
          '.entries-tab',
          'button[data-tutorial-target="past-entries"]',
          '#past-entries-button'
        ];
        
        selectors.forEach(selector => {
          const element = document.querySelector(selector);
          if (element) {
            element.classList.remove('tutorial-target', 'entries-tab');
          }
        });
      }
    };
  }, [step.id, step.targetElement, step.position, position]);
  
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
  
  // Set background color based on step ID - make step 3 and 4 fully opaque
  const getBackgroundStyle = () => {
    // Steps 3 and 4 should be fully opaque
    if (step.id === 3 || step.id === 4) {
      return {
        backgroundColor: '#1A1F2C', // Dark opaque background
        color: 'white',             // White text for better contrast
        boxShadow: '0 0 20px rgba(0, 0, 0, 0.8)', // Stronger shadow
        border: '3px solid var(--color-theme)' // Thicker purple border
      };
    }
    
    // Default styling for other steps
    return {};
  };
  
  return (
    <motion.div
      ref={stepRef}
      className="absolute bg-card border border-theme shadow-lg rounded-xl p-4 z-[20000] max-w-[320px] tutorial-step-container"
      style={{
        ...getPositionStyle(),
        ...getBackgroundStyle()
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3 }}
      onClick={(e) => e.stopPropagation()} // Prevent clicks from reaching elements behind
      data-step={step.id} // Add data attribute for easier CSS targeting
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
