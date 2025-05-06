
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useTutorial, TutorialStep } from '@/contexts/TutorialContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { isAppRoute } from '@/routes/RouteHelpers';
import { 
  ChevronRight, 
  ChevronLeft, 
  X, 
  SkipForward
} from 'lucide-react';

const TutorialOverlay = () => {
  const { 
    isTutorialActive,
    currentStep,
    nextStep,
    previousStep,
    skipTutorial,
    currentStepIndex,
    steps
  } = useTutorial();
  
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [targetElementPosition, setTargetElementPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Only show tutorial on app routes
  const isAppPath = isAppRoute(location.pathname);
  
  // If not on an app route, don't render anything
  if (!isAppPath) {
    return null;
  }
  
  // Find the target element and calculate its position
  useEffect(() => {
    if (!isTutorialActive || !currentStep || !currentStep.targetElementId) return;
    
    // If step requires navigation to a specific route
    if (currentStep.route && window.location.pathname !== currentStep.route) {
      navigate(currentStep.route);
      
      // After navigation, we need a timeout to let the DOM update
      setTimeout(calculatePositions, 300);
      return;
    }
    
    calculatePositions();
  }, [currentStep, isTutorialActive]);
  
  const calculatePositions = () => {
    if (!currentStep || !currentStep.targetElementId) {
      // Center the tooltip if no target element
      setTooltipPosition({
        top: window.innerHeight / 2,
        left: window.innerWidth / 2
      });
      return;
    }
    
    const targetElement = document.getElementById(currentStep.targetElementId);
    if (!targetElement) {
      console.warn(`Target element with id ${currentStep.targetElementId} not found.`);
      return;
    }
    
    const rect = targetElement.getBoundingClientRect();
    setTargetElementPosition({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    });
    
    // Calculate tooltip position based on the target element and desired position
    calculateTooltipPosition(rect, currentStep.position || 'bottom');
  };
  
  const calculateTooltipPosition = (targetRect: DOMRect, position: TutorialStep['position']) => {
    const tooltipHeight = tooltipRef.current?.clientHeight || 150;
    const tooltipWidth = tooltipRef.current?.clientWidth || 300;
    const margin = 20; // Distance from the target element
    
    let top = 0;
    let left = 0;
    
    switch (position) {
      case 'top':
        top = targetRect.top - tooltipHeight - margin;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'bottom':
        top = targetRect.bottom + margin;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.left - tooltipWidth - margin;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.right + margin;
        break;
      default:
        top = targetRect.bottom + margin;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
    }
    
    // Ensure the tooltip stays within the viewport bounds
    top = Math.max(10, Math.min(window.innerHeight - tooltipHeight - 10, top));
    left = Math.max(10, Math.min(window.innerWidth - tooltipWidth - 10, left));
    
    setTooltipPosition({ top, left });
  };
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => calculatePositions();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentStep]);
  
  if (!isTutorialActive || !currentStep) return null;
  
  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 z-[1000] pointer-events-auto">
        {/* Highlight around the target element */}
        {currentStep.targetElementId && (
          <div 
            className="absolute rounded-lg"
            style={{
              top: targetElementPosition.top - 4,
              left: targetElementPosition.left - 4,
              width: targetElementPosition.width + 8,
              height: targetElementPosition.height + 8,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65), 0 0 15px rgba(255, 255, 255, 0.6)',
              pointerEvents: 'none',
              zIndex: 1001
            }}
          />
        )}
        
        {/* Tooltip */}
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          className="absolute z-[1002] bg-card rounded-lg shadow-xl p-5 w-[300px] md:w-[350px]"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            transform: 'translate(-50%, 0)',
            maxWidth: 'calc(100vw - 40px)'
          }}
        >
          <div className="absolute top-2 right-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={skipTutorial}
              aria-label="Skip tutorial"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <h3 className="text-lg font-semibold mb-2 pr-6">
            <TranslatableText text={currentStep.title} />
          </h3>
          
          <p className="mb-4 text-muted-foreground">
            <TranslatableText text={currentStep.content} />
          </p>
          
          {/* Progress indicator */}
          <div className="flex justify-center gap-1 mb-4">
            {steps.map((_, idx) => (
              <div 
                key={idx}
                className={`h-1.5 rounded-full ${idx === currentStepIndex ? 'w-4 bg-primary' : 'w-2 bg-primary/30'}`}
              />
            ))}
          </div>
          
          <div className="flex justify-between items-center">
            <Button 
              variant="outline"
              size="sm"
              onClick={skipTutorial}
              className="text-xs"
            >
              <SkipForward className="h-3 w-3 mr-1" />
              <TranslatableText text="Skip Tour" />
            </Button>
            
            <div className="flex gap-2">
              {currentStepIndex > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={previousStep}
                  aria-label="Previous step"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              
              <Button
                onClick={nextStep}
                size="sm"
              >
                <TranslatableText text={currentStep.nextButtonText || 'Next'} />
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TutorialOverlay;
