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
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const [renderKey, setRenderKey] = useState(0);
  
  // Force re-render on step changes to ensure clean positioning
  useEffect(() => {
    console.log(`TutorialStep received new step: ${step.id}`);
    setRenderKey(prev => prev + 1);
  }, [step.id]);
  
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
    console.log(`Calculating position for step ${step.id}, render key: ${renderKey}`);
    
    // Always position in center for all steps during tutorial
    setPosition({
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    });
    
    // Second positioning pass with a short delay for element highlighting
    const secondaryCheck = setTimeout(() => {
      // This is when we handle element highlighting
      if (step.id === 1) {
        // Step 1: Journal header
        const journalHeader = document.querySelector('.journal-header-container');
        if (journalHeader) {
          journalHeader.classList.add('tutorial-target');
        }
      } else if (step.id === 2) {
        // Step 2: Arrow button
        const arrowButton = document.querySelector('.journal-arrow-button');
        if (arrowButton) {
          arrowButton.classList.add('tutorial-target');
          // Add special highlighting to button element
          const buttonElement = arrowButton.querySelector('button');
          if (buttonElement) {
            buttonElement.classList.add('tutorial-button-highlight');
          }
        }
      } else if (step.id === 3) {
        // Step 3: Record entry button
        const selectors = [
          '.tutorial-record-entry-button',
          '[data-value="record"]',
          '.record-entry-tab',
          'button[data-tutorial-target="record-entry"]',
          '#new-entry-button'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            element.classList.add('tutorial-target');
            element.classList.add('record-entry-tab');
            break;
          }
        }
      } else if (step.id === 4) {
        // Step 4: Past entries tab
        const selectors = [
          '[value="entries"]',
          '.entries-tab',
          'button[data-tutorial-target="past-entries"]',
          '#past-entries-button'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            element.classList.add('tutorial-target');
            element.classList.add('entries-tab');
            break;
          }
        }
      }
    }, 200);
    
    return () => {
      clearTimeout(secondaryCheck);
      
      // Clean up highlighting when step changes
      if (step.id === 1) {
        const journalHeader = document.querySelector('.journal-header-container');
        if (journalHeader) {
          journalHeader.classList.remove('tutorial-target');
        }
      } else if (step.id === 2) {
        const arrowButton = document.querySelector('.journal-arrow-button');
        if (arrowButton) {
          arrowButton.classList.remove('tutorial-target');
          const buttonElement = arrowButton.querySelector('button');
          if (buttonElement) {
            buttonElement.classList.remove('tutorial-button-highlight');
          }
        }
      } else if (step.id === 3) {
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
      } else if (step.id === 4) {
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
  }, [step.id, renderKey]);
  
  // Enhanced Next button click handling with direct event capture
  const handleNext = (e: React.MouseEvent) => {
    // First log the click event
    console.log(`[DEBUG] Next button clicked for step ${step.id}`);
    
    // Stop propagation more aggressively
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Force immediate propagation stop
      if (e.nativeEvent) {
        e.nativeEvent.stopImmediatePropagation();
      }
    }
    
    // Log the full onNext function
    console.log('onNext function:', onNext);
    
    // Call onNext directly and immediately
    onNext();
    
    // Log completion of the next action
    console.log(`Tutorial: Next button clicked and onNext called for step ${step.id}`);
  };
  
  // Ensure the handlePrev function has the same aggressive event handling
  const handlePrev = (e: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.nativeEvent) {
        e.nativeEvent.stopImmediatePropagation();
      }
    }
    console.log(`Tutorial: Previous button clicked for step ${step.id}`);
    onPrev();
  };
  
  // Ensure the handleSkip function has the same aggressive event handling
  const handleSkip = (e: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.nativeEvent) {
        e.nativeEvent.stopImmediatePropagation();
      }
    }
    console.log("Tutorial: Skip button clicked");
    onSkip();
  };
  
  // Add direct DOM click handler as backup to ensure button clicks are captured
  useEffect(() => {
    if (nextButtonRef.current) {
      const handleDirectClick = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Direct DOM click handler fired on next button');
        onNext();
      };
      
      // Add the direct event listener
      nextButtonRef.current.addEventListener('click', handleDirectClick, { capture: true });
      
      // Log that we've set up the direct handler
      console.log('Direct click handler added to next button');
      
      return () => {
        if (nextButtonRef.current) {
          nextButtonRef.current.removeEventListener('click', handleDirectClick, { capture: true });
        }
      };
    }
  }, [onNext]);
  
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
      className="absolute bg-card border border-theme shadow-lg rounded-xl p-4 max-w-[320px] tutorial-step-container"
      style={{
        top: position.top,
        left: position.left,
        right: position.right,
        transform: position.transform,
        backgroundColor: '#1A1F2C', // Dark background for all steps
        color: 'white',             // White text for all steps
        border: '3px solid var(--color-theme)',
        boxShadow: '0 0 30px rgba(0, 0, 0, 0.7)',
        zIndex: 30000, // Significantly increased z-index for all steps
        pointerEvents: 'auto'
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3 }}
      onClick={(e) => e.stopPropagation()} // Prevent clicks from reaching elements behind
      data-step={step.id} // Add data attribute for easier CSS targeting
      key={`step-${step.id}-${renderKey}`} // Add render key to force re-render
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
      
      {/* Navigation buttons with enhanced click handling */}
      <div className="flex justify-between mt-2 tutorial-buttons">
        {!isFirst && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePrev}
            className="flex items-center gap-1 pointer-events-auto border-white/30 text-white hover:text-white/90 hover:bg-white/10"
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
            onMouseDown={(e) => e.stopPropagation()}
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
