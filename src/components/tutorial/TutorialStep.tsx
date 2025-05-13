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
    // Function to calculate position with enhanced logging
    const calculatePosition = () => {
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
      // Handle step 3 positioning for record entry button
      else if (step.id === 3) {
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
          const calculatedPos = {
            top: rect.bottom + 20, // Below the element
            left: rect.left + (rect.width / 2),
            transform: 'translateX(-50%)'
          };
          
          // Enhanced viewport adjustment for step 3
          const adjustedPos = ensureWithinViewport(calculatedPos);
          setPosition(adjustedPos);
          
          console.log("Positioned step 3 popup at:", adjustedPos);
        } else {
          console.warn("Could not find record entry element for step 3, using fallback position");
          // Fallback position - center of screen for better visibility
          const fallbackPos = { 
            top: '40%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)' 
          };
          
          setPosition(ensureWithinViewport(fallbackPos));
        }
      } 
      // Handle step 4 positioning for past entries tab
      else if (step.id === 4) {
        // For step 4 - find the Past Entries tab using the same approach as step 3 for consistency
        console.log("Calculating position for step 4...");
        
        const selectors = [
          '[value="entries"]',
          '.entries-tab',
          'button[data-tutorial-target="past-entries"]',
          '#past-entries-button'
        ];
        
        let entriesTabElement = null;
        let usedSelector = '';
        
        // Try each selector
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            entriesTabElement = element;
            usedSelector = selector;
            console.log(`Found step 4 target using selector: ${selector}`, element);
            break;
          }
        }
        
        if (entriesTabElement) {
          const rect = entriesTabElement.getBoundingClientRect();
          console.log(`Step 4 element rect using ${usedSelector}:`, rect);
          
          // Add tutorial target class to ensure visibility
          entriesTabElement.classList.add('tutorial-target');
          entriesTabElement.classList.add('entries-tab');
          
          // Mobile special positioning - on mobile devices, users may not see popups that are too low
          const isMobile = window.innerWidth < 640;
          let calculatedPos: PositionState;
          
          if (isMobile) {
            // For mobile, position centered in the bottom half of screen for better visibility
            calculatedPos = {
              top: Math.min(rect.bottom + 20, window.innerHeight * 0.6), // No lower than 60% of screen height
              left: '50%',
              transform: 'translateX(-50%)'
            };
          } else {
            // Desktop positioning - below the tab
            calculatedPos = {
              top: rect.bottom + 20,
              left: rect.left + (rect.width / 2),
              transform: 'translateX(-50%)'
            };
          }
          
          // Super-enhanced viewport adjustment specifically for step 4
          // Force it up higher in the screen if at the bottom
          const adjustedPos = { ...ensureWithinViewport(calculatedPos) };
          
          // Final adjustment to ensure it's visible - if still too low on screen, move it up
          if (typeof adjustedPos.top === 'number' && adjustedPos.top > window.innerHeight * 0.7) {
            adjustedPos.top = window.innerHeight * 0.5;
            // Ensure it's centered horizontally for better visibility
            adjustedPos.left = '50%'; 
            adjustedPos.transform = 'translate(-50%, -50%)';
          }
          
          setPosition(adjustedPos);
          console.log("Positioned step 4 popup at:", adjustedPos);
        } else {
          console.warn("Could not find Past Entries tab for step 4, using fallback position");
          // Fallback position - similar to step 3's fallback but adjusted for viewport
          const fallbackPos = { 
            top: '40%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)' 
          };
          
          setPosition(ensureWithinViewport(fallbackPos));
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
      // Final forced position check - especially important for step 4
      if (step.id === 4) {
        console.log("Performing final position check for step 4");
        if (stepRef.current) {
          const rect = stepRef.current.getBoundingClientRect();
          console.log("Current step 4 popup position:", rect);
          
          // If popup is off screen or too close to bottom, force it to center
          if (rect.bottom > window.innerHeight - 20 || rect.top < 20) {
            console.log("Step 4 popup may be off screen, forcing center position");
            setPosition({
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            });
          }
        }
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
  
  return (
    <motion.div
      ref={stepRef}
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
