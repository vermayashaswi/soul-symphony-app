
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronRight, X } from 'lucide-react';
import { useTutorial, TutorialStep } from '@/contexts/TutorialContext';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface TooltipPositionStyles {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  transform?: string;
  maxWidth?: string;
}

const TutorialOverlay: React.FC = () => {
  const { 
    isActive, 
    currentStepDetails, 
    nextStep, 
    skipTutorial, 
    totalSteps,
    currentStep 
  } = useTutorial();
  
  const [tooltipStyles, setTooltipStyles] = useState<TooltipPositionStyles>({});
  const [highlightStyles, setHighlightStyles] = useState({
    top: '50%',
    left: '50%',
    width: '80%',
    height: '80%',
    transform: 'translate(-50%, -50%)',
  });
  const [isCentered, setIsCentered] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Function to ensure tooltip is within viewport
  const adjustTooltipPosition = (initialStyles: TooltipPositionStyles) => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return initialStyles;

    const adjustedStyles = { ...initialStyles };
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // Check if tooltip would be cut off at bottom
    if (tooltipRect.bottom > window.innerHeight - 80) { // Add 80px buffer for mobile nav
      // If tooltip is positioned from top, adjust top value
      if (adjustedStyles.top) {
        const newTop = Math.max(0, window.innerHeight - tooltipRect.height - 100);
        adjustedStyles.top = `${newTop}px`;
        delete adjustedStyles.bottom; // Remove bottom if it exists
      }
      // If tooltip is positioned from bottom, just ensure it's visible
      else if (adjustedStyles.bottom) {
        adjustedStyles.bottom = `${Math.min(parseInt(adjustedStyles.bottom), window.innerHeight - tooltipRect.height - 20)}px`;
      }
    }

    // Check if tooltip would be cut off at top
    if (tooltipRect.top < 10) {
      if (adjustedStyles.top) {
        adjustedStyles.top = '10px';
      }
    }

    // Check if tooltip would be cut off on the sides
    const maxWidth = window.innerWidth - 20;
    if (tooltipRect.right > maxWidth) {
      adjustedStyles.left = `${Math.max(10, maxWidth - tooltipRect.width)}px`;
      delete adjustedStyles.right; // Remove right if it exists
    }

    if (tooltipRect.left < 10) {
      adjustedStyles.left = '10px';
      delete adjustedStyles.right; // Remove right if it exists
    }
    
    // Set maxWidth to prevent overflow
    adjustedStyles.maxWidth = `${Math.min(tooltipRect.width, maxWidth - 20)}px`;
    
    return adjustedStyles;
  };

  // When the step changes, find the target element and position the tooltip
  useEffect(() => {
    if (!isActive || !currentStepDetails) return;
    
    // Small delay to ensure DOM elements are ready
    const timerId = setTimeout(() => {
      positionTooltipForStep(currentStepDetails);
    }, 300);
    
    return () => clearTimeout(timerId);
  }, [currentStepDetails, isActive]);

  // After tooltip is positioned initially, check if it's within viewport
  useEffect(() => {
    if (!isActive || !tooltipRef.current) return;
    
    // Additional delay to check positioning after initial placement
    const checkTimerId = setTimeout(() => {
      const adjustedStyles = adjustTooltipPosition(tooltipStyles);
      setTooltipStyles(adjustedStyles);
    }, 500);
    
    return () => clearTimeout(checkTimerId);
  }, [tooltipStyles, isActive]);

  // Handle positioning of tooltip relative to the target element
  const positionTooltipForStep = (step: TutorialStep) => {
    if (step.position === 'center') {
      // Center overlay tooltip - full screen overlay with centered tooltip
      setIsCentered(true);
      setTooltipStyles({
        top: '40%', // Move up slightly from center
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '80%'
      });
      setHighlightStyles({
        top: '50%',
        left: '50%',
        width: '80%',
        height: '80%',
        transform: 'translate(-50%, -50%)',
      });
      return;
    }
    
    setIsCentered(false);
    
    // For specific UI element targeting
    let targetElement: Element | null = null;
    
    // Try to find by ID first
    if (step.targetId) {
      targetElement = document.getElementById(step.targetId);
      
      // If not found by ID, try to find by data attribute
      if (!targetElement) {
        targetElement = document.querySelector(`[data-tutorial="${step.targetId}"]`);
      }
      
      // If still not found, try to find by class name
      if (!targetElement) {
        targetElement = document.querySelector(`.${step.targetId}`);
      }
    }
    
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const margin = 10; // margin around the highlighted element
      
      // Set highlight styles based on target element
      setHighlightStyles({
        top: `${rect.top - margin}px`,
        left: `${rect.left - margin}px`,
        width: `${rect.width + margin * 2}px`,
        height: `${rect.height + margin * 2}px`,
        transform: 'none',
      });
      
      // Position tooltip based on specified position
      const tooltipWidth = 280;
      const tooltipHeight = 160;
      
      let initialTooltipStyles: TooltipPositionStyles = {};
      
      switch (step.position) {
        case 'top':
          initialTooltipStyles = {
            bottom: `${window.innerHeight - rect.top + 10}px`,
            left: `${rect.left + rect.width / 2 - tooltipWidth / 2}px`,
          };
          break;
        case 'bottom':
          // For bottom positioning, ensure it's not too low
          if (rect.bottom + tooltipHeight + 10 > window.innerHeight - 80) {
            // If would be too low, position above instead
            initialTooltipStyles = {
              bottom: `${window.innerHeight - rect.top + 10}px`,
              left: `${rect.left + rect.width / 2 - tooltipWidth / 2}px`,
            };
          } else {
            initialTooltipStyles = {
              top: `${rect.bottom + 10}px`,
              left: `${rect.left + rect.width / 2 - tooltipWidth / 2}px`,
            };
          }
          break;
        case 'left':
          initialTooltipStyles = {
            top: `${rect.top + rect.height / 2 - tooltipHeight / 2}px`,
            right: `${window.innerWidth - rect.left + 10}px`,
          };
          break;
        case 'right':
          initialTooltipStyles = {
            top: `${rect.top + rect.height / 2 - tooltipHeight / 2}px`,
            left: `${rect.right + 10}px`,
          };
          break;
      }
      
      setTooltipStyles(initialTooltipStyles);
    } else {
      console.warn(`Tutorial target element not found: ${step.targetId}`);
      // Fallback to center if target not found
      setIsCentered(true);
      setTooltipStyles({
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '80%'
      });
    }
  };

  if (!isActive || !currentStepDetails) return null;

  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 z-[9999] pointer-events-auto"
      style={{ 
        touchAction: 'none',
        overscrollBehavior: 'none' 
      }}
    >
      {/* Semi-transparent backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={skipTutorial} />
      
      {/* Highlight area (transparent cutout) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepDetails.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          className="absolute rounded-xl pointer-events-none"
          style={{
            ...highlightStyles,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          }}
        />
      </AnimatePresence>
      
      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepDetails.id}
          ref={tooltipRef}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className={`absolute bg-background rounded-lg shadow-lg border border-border p-4 w-[280px] max-w-[90vw] z-[10000] pointer-events-auto ${isCentered ? 'text-center' : ''}`}
          style={tooltipStyles}
        >
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-lg text-theme-color">
              <TranslatableText text={currentStepDetails.title} forceTranslate />
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={skipTutorial}
              title="Close tutorial"
            >
              <X size={16} />
            </Button>
          </div>
          
          <div className="text-sm text-foreground mb-4">
            <TranslatableText text={currentStepDetails.content} forceTranslate />
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <div className="text-xs text-muted-foreground">
              <TranslatableText text={`Step ${currentStep + 1} of ${totalSteps}`} forceTranslate />
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={skipTutorial}
                className="h-8 text-xs"
              >
                <TranslatableText text="Skip" forceTranslate />
              </Button>
              <Button
                size="sm"
                onClick={nextStep}
                className="h-8 text-xs flex items-center gap-1"
              >
                <TranslatableText text="Next" forceTranslate />
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default TutorialOverlay;
