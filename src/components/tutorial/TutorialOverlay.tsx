
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from '@/contexts/TutorialContext';
import TutorialStep from './TutorialStep';
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
  
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  
  // Find target element based on the current step
  useEffect(() => {
    if (!isActive || currentStep === 0 || !mounted) return;
    
    const step = tutorialSteps[currentStep - 1];
    if (!step) return;

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
      } else {
        // If element not found, retry after a short delay
        setTimeout(findElement, 500);
      }
    };

    // Small delay to ensure page has rendered
    setTimeout(findElement, 300);
    
    // Add resize listener to update position
    const handleResize = () => {
      findElement();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isActive, currentStep, tutorialSteps, mounted]);
  
  if (!mounted || !isActive) return null;
  
  const currentTutorialStep = tutorialSteps[currentStep - 1];
  const isLastStep = currentStep === tutorialSteps.length;
  const isFirstStep = currentStep === 1;
  const isCenterStep = currentTutorialStep?.position === 'center';
  
  // Position for the tooltip
  const getTooltipPosition = () => {
    if (isCenterStep || !targetElement) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }
    
    const position = currentTutorialStep.position || 'bottom';
    const padding = 20;
    
    switch (position) {
      case 'top':
        return {
          top: `${Math.max(20, elementPosition.top - padding - 150)}px`,
          left: `${elementPosition.left + elementPosition.width / 2}px`,
          transform: 'translateX(-50%)'
        };
      case 'bottom':
        return {
          top: `${elementPosition.top + elementPosition.height + padding}px`,
          left: `${elementPosition.left + elementPosition.width / 2}px`,
          transform: 'translateX(-50%)'
        };
      case 'left':
        return {
          top: `${elementPosition.top + elementPosition.height / 2}px`,
          left: `${Math.max(20, elementPosition.left - padding - 250)}px`,
          transform: 'translateY(-50%)'
        };
      case 'right':
        return {
          top: `${elementPosition.top + elementPosition.height / 2}px`,
          left: `${elementPosition.left + elementPosition.width + padding}px`,
          transform: 'translateY(-50%)'
        };
      default:
        return {
          top: `${elementPosition.top + elementPosition.height + padding}px`,
          left: `${elementPosition.left + elementPosition.width / 2}px`,
          transform: 'translateX(-50%)'
        };
    }
  };
  
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
    
    return `circle(${radiusPercent + 3}% at ${centerXPercent}% ${centerYPercent}%)`;
  };

  // Portal for the overlay and step
  return createPortal(
    <AnimatePresence>
      {isActive && (
        <>
          {/* Dimmed overlay with spotlight */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998]"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(2px)', 
              WebkitBackdropFilter: 'blur(2px)',
              clipPath: getSpotlightClipPath()
            }}
          >
            {/* This div is for the spotlight effect */}
          </motion.div>
          
          {/* Solid background around the spotlight */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9997] pointer-events-auto"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
              clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${getSpotlightClipPath()})`,
              WebkitClipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${getSpotlightClipPath()})`,
            }}
          />
          
          {/* Tutorial step */}
          <motion.div
            key={`tutorial-step-${currentStep}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="fixed z-[9999] pointer-events-auto"
            style={getTooltipPosition()}
          >
            <TutorialStep
              step={currentStep}
              totalSteps={tutorialSteps.length}
              title={currentTutorialStep?.title || ''}
              description={currentTutorialStep?.description || ''}
              onNext={isLastStep ? completeTutorial : nextStep}
              onPrevious={previousStep}
              onSkip={skipTutorial}
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
