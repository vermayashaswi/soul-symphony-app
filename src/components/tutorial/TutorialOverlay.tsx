
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from '@/contexts/TutorialContext';
import TutorialStep from './TutorialStep';
import TutorialConnector from './TutorialConnector';
import { createPortal } from 'react-dom';

const TutorialOverlay: React.FC = () => {
  const { 
    isActive, 
    currentStep, 
    tutorialSteps,
    nextStep,
    previousStep,
    skipTutorial,
    completeTutorial
  } = useTutorial();
  
  const [mounted, setMounted] = useState(false);
  const [targetElement, setTargetElement] = useState<Element | null>(null);
  const [elementPosition, setElementPosition] = useState({ 
    top: 0, 
    left: 0, 
    width: 0, 
    height: 0 
  });
  const [tooltipPosition, setTooltipPosition] = useState({
    top: 0,
    left: 0
  });
  const [connectorStart, setConnectorStart] = useState({ x: 0, y: 0 });
  const [connectorEnd, setConnectorEnd] = useState({ x: 0, y: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInitialRender, setIsInitialRender] = useState(true);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const findElementAttempts = useRef(0);
  
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset initial render flag when steps change
  useEffect(() => {
    if (currentStep > 0) {
      // Small delay before resetting to prevent flicker during transitions
      const timer = setTimeout(() => {
        setIsInitialRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  // Calculate connector points when element or tooltip positions change
  useEffect(() => {
    if (!targetElement || !tooltipRef.current) return;
    
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const position = tutorialSteps[currentStep - 1]?.position || 'bottom';
    
    // Calculate center points of the element and tooltip
    const elementCenterX = elementPosition.left + elementPosition.width / 2;
    const elementCenterY = elementPosition.top + elementPosition.height / 2;
    const tooltipCenterX = tooltipRect.left + tooltipRect.width / 2;
    const tooltipCenterY = tooltipRect.top + tooltipRect.height / 2;
    
    let start = { x: 0, y: 0 };
    let end = { x: 0, y: 0 };
    
    // Calculate connector start and end points based on position
    switch (position) {
      case 'top':
        start = { x: elementCenterX, y: elementPosition.top };
        end = { x: tooltipCenterX, y: tooltipRect.bottom };
        break;
      case 'bottom':
        start = { x: elementCenterX, y: elementPosition.top + elementPosition.height };
        end = { x: tooltipCenterX, y: tooltipRect.top };
        break;
      case 'left':
        start = { x: elementPosition.left, y: elementCenterY };
        end = { x: tooltipRect.right, y: tooltipCenterY };
        break;
      case 'right':
        start = { x: elementPosition.left + elementPosition.width, y: elementCenterY };
        end = { x: tooltipRect.left, y: tooltipCenterY };
        break;
      default:
        break;
    }
    
    setConnectorStart(start);
    setConnectorEnd(end);
  }, [elementPosition, tooltipPosition, targetElement, currentStep, tutorialSteps]);
  
  // Find target element based on the current step
  useEffect(() => {
    if (!isActive || currentStep === 0 || !mounted || isTransitioning) return;
    
    const step = tutorialSteps[currentStep - 1];
    if (!step) return;
    
    findElementAttempts.current = 0;

    const findElement = () => {
      if (!step.targetSelector || step.position === 'center') {
        setTargetElement(null);
        return;
      }
      
      const element = document.querySelector(step.targetSelector);
      if (element) {
        setTargetElement(element);
        const rect = element.getBoundingClientRect();
        setElementPosition({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        });

        // Calculate tooltip position based on element position
        calculateTooltipPosition(rect, step.position || 'bottom');
      } else {
        // If element not found and we haven't tried too many times, retry
        if (findElementAttempts.current < 10) {
          findElementAttempts.current += 1;
          setTimeout(findElement, 300);
        } else {
          console.error(`Could not find element with selector: ${step.targetSelector}`);
          // Fall back to center positioning if element cannot be found
          setTargetElement(null);
          calculateTooltipPosition(null, 'center');
        }
      }
    };

    // Small delay to ensure page has rendered
    const timer = setTimeout(findElement, 300);
    
    // Add resize listener to update position
    const handleResize = () => {
      if (isTransitioning) return;
      findElement();
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [isActive, currentStep, tutorialSteps, mounted, isTransitioning]);
  
  // Calculate tooltip position based on element position and desired placement
  const calculateTooltipPosition = (rect: DOMRect | null, position: string = 'bottom') => {
    const padding = 20;
    const tooltipWidth = 350; // Based on max-width of tooltip
    const tooltipHeight = 250; // Estimated average height
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let top = 0;
    let left = 0;
    
    if (rect) {
      switch (position) {
        case 'top':
          top = Math.max(20, rect.top - tooltipHeight - padding);
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'bottom':
          top = rect.bottom + padding;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = Math.max(20, rect.left - tooltipWidth - padding);
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + padding;
          break;
        case 'center':
          top = windowHeight / 2 - tooltipHeight / 2;
          left = windowWidth / 2 - tooltipWidth / 2;
          break;
      }
    } else {
      // Center position if no rect is provided
      top = windowHeight / 2 - tooltipHeight / 2;
      left = windowWidth / 2 - tooltipWidth / 2;
    }
    
    // Ensure tooltip stays within viewport bounds
    left = Math.max(20, Math.min(left, windowWidth - tooltipWidth - 20));
    top = Math.max(20, Math.min(top, windowHeight - tooltipHeight - 20));
    
    setTooltipPosition({ top, left });
  };
  
  // Handle step transitions with smooth animations
  const handleStepTransition = (action: () => void) => {
    // Set transitioning state to prevent position calculations during animation
    setIsTransitioning(true);
    
    // Execute the action (next, previous, etc.) after fade out
    setTimeout(() => {
      action();
      
      // Reset transitioning state after new content has loaded
      setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
    }, 200);
  };
  
  const handleNext = () => handleStepTransition(isLastStep ? completeTutorial : nextStep);
  const handlePrevious = () => handleStepTransition(previousStep);
  const handleSkip = () => handleStepTransition(skipTutorial);
  
  const currentTutorialStep = tutorialSteps[currentStep - 1];
  const isLastStep = currentStep === tutorialSteps.length;
  const isFirstStep = currentStep === 1;
  const isCenterStep = currentTutorialStep?.position === 'center';
  const showConnector = !isCenterStep && targetElement && !isTransitioning;
  
  // Calculate spotlight position
  const getSpotlightClipPath = () => {
    if (isCenterStep || !targetElement) {
      return 'circle(15% at 50% 50%)';
    }
    
    const centerX = elementPosition.left + elementPosition.width / 2;
    const centerY = elementPosition.top + elementPosition.height / 2;
    const radius = Math.max(elementPosition.width, elementPosition.height) * 0.8;
    
    // Convert to viewport percentage
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const centerXPercent = (centerX / viewportWidth) * 100;
    const centerYPercent = (centerY / viewportHeight) * 100;
    const radiusPercent = (radius / Math.min(viewportWidth, viewportHeight)) * 100;
    
    return `circle(${radiusPercent + 5}% at ${centerXPercent}% ${centerYPercent}%)`;
  };

  // Portal for the overlay and step
  if (!mounted || !isActive) return null;
  
  return createPortal(
    <AnimatePresence mode="sync">
      {isActive && (
        <>
          {/* Dimmed overlay with spotlight - adjusted to 25% opacity (75% visibility) */}
          <motion.div
            key="spotlight-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9997] pointer-events-auto"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.25)', // Changed to 25% opacity (75% visibility)
              backdropFilter: 'blur(0.5px)', // Minimal blur effect
              WebkitBackdropFilter: 'blur(0.5px)', // Minimal blur for Safari
              clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${getSpotlightClipPath()})`,
              WebkitClipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${getSpotlightClipPath()})`,
            }}
          />
          
          {/* Connector line between tooltip and target element */}
          {showConnector && !isInitialRender && (
            <TutorialConnector
              start={connectorStart}
              end={connectorEnd}
              position={currentTutorialStep?.position || 'bottom'}
            />
          )}
          
          {/* Tutorial step */}
          <motion.div
            ref={tooltipRef}
            key={`tutorial-step-${currentStep}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ 
              type: "spring",
              damping: 30,
              stiffness: 500,
              duration: 0.4 
            }}
            className="fixed z-[9999] pointer-events-auto"
            style={{
              top: tooltipPosition.top,
              left: tooltipPosition.left
            }}
          >
            <TutorialStep
              step={currentStep}
              totalSteps={tutorialSteps.length}
              title={currentTutorialStep?.title || ''}
              description={currentTutorialStep?.description || ''}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onSkip={handleSkip}
              isFirstStep={isFirstStep}
              isLastStep={isLastStep}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default TutorialOverlay;
