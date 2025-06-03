import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import { TutorialStep as TutorialStepType } from '@/contexts/TutorialContext';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import TutorialInfographic from './TutorialInfographic';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { PremiumBadge } from '@/components/onboarding/PremiumBadge';

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
  const [isInfographicMounted, setIsInfographicMounted] = useState(false);
  const [isStepFullyRendered, setIsStepFullyRendered] = useState(false);
  
  // Determine whether to show the infographic and which type - MOVED UP
  const shouldShowInfographic = !!step.infographicType && step.id >= 6 && step.id <= 9;
  
  // Improved logging for debugging
  useEffect(() => {
    console.log(`TutorialStep mounted for step ${step.id}, renderKey: ${renderKey}`);
    
    // Mark step as fully rendered after a brief delay
    const renderTimeout = setTimeout(() => {
      setIsStepFullyRendered(true);
      console.log(`Step ${step.id} marked as fully rendered`);
    }, 100);
    
    return () => {
      console.log(`TutorialStep unmounted for step ${step.id}`);
      clearTimeout(renderTimeout);
    };
  }, [step.id, renderKey]);
  
  // Enhanced infographic mounting logic with proper delays
  useEffect(() => {
    if (shouldShowInfographic && isStepFullyRendered) {
      console.log(`Starting infographic mount sequence for step ${step.id}`);
      
      // Progressive mounting with increasing delays for better stability
      const baseDelay = step.id >= 6 && step.id <= 9 ? 600 : 400;
      const additionalDelay = (step.id - 6) * 100; // Stagger based on step
      const totalDelay = baseDelay + additionalDelay;
      
      const mountTimeout = setTimeout(() => {
        console.log(`Mounting infographic for step ${step.id} after ${totalDelay}ms delay`);
        setIsInfographicMounted(true);
        
        // Force a layout recalculation after mounting
        setTimeout(() => {
          if (stepRef.current) {
            console.log(`Forcing layout recalculation for step ${step.id}`);
            stepRef.current.style.transform = stepRef.current.style.transform;
            
            // Trigger a resize event to ensure proper rendering
            window.dispatchEvent(new Event('resize'));
          }
        }, 50);
      }, totalDelay);
      
      return () => {
        clearTimeout(mountTimeout);
      };
    } else if (!shouldShowInfographic) {
      // Reset for non-infographic steps
      setIsInfographicMounted(false);
    }
  }, [shouldShowInfographic, isStepFullyRendered, step.id]);
  
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
  
  // Get background color based on step ID
  const getBackgroundStyle = () => {
    // All steps should be fully opaque, especially step 5
    if (step.id === 5) {
      return {
        backgroundColor: 'rgba(26, 31, 44, 1)', // Fully opaque for step 5
        color: 'white',
        textShadow: '0 0 4px rgba(0, 0, 0, 0.8)' // Text shadow for readability
      };
    }
    
    // Step 1 should be fully opaque
    if (step.id === 1) {
      return {
        backgroundColor: 'rgba(26, 31, 44, 1)', // Fully opaque background for step 1
        color: 'white',
        textShadow: '0 0 4px rgba(0, 0, 0, 0.8)' // Text shadow for readability
      };
    }
    
    // Other steps have semi-transparent background with blur
    return {
      backgroundColor: 'rgba(26, 31, 44, 0.2)', // Very light background for other steps
      backdropFilter: 'blur(2px)', // Slight blur to improve text readability
      color: 'white',
      textShadow: '0 0 4px rgba(0, 0, 0, 0.8)' // Text shadow to ensure readability
    };
  };
  
  // Adjust container width if it has an image
  const getContainerWidth = () => {
    // Make steps with images wider
    if (step.infographicType && (step.id >= 6 && step.id <= 9)) {
      return {
        maxWidth: '350px', // Wider for steps with images
        width: 'calc(100% - 40px)'
      };
    }
    
    return {
      maxWidth: '320px',
      width: 'calc(100% - 40px)'
    };
  };
  
  // Improved modal positioning based on step ID - use fixed positioning for consistency
  const getPositionStyle = () => {
    // Special positioning for step 2 to move it to the very top so arrow button is visible
    if (step.id === 2) {
      return {
        top: '10%',  // Moved to very top (from 35% to 10%)
        left: '50%',
        transform: 'translate(-50%, 0)', // Changed from -50% for y to avoid centering
        position: 'fixed' as const
      };
    }
    
    // For step 5 - position higher to avoid the chat input box at bottom
    if (step.id === 5) {
      return {
        top: '10%',  // Positioned much higher (changed from 15% to 10%)
        left: '50%',
        transform: 'translate(-50%, 0)', // Changed from -50% for y to avoid centering
        position: 'fixed' as const,
        zIndex: 30000
      };
    }
    
    // For steps with infographics (6-9) - centered to ensure they're visible
    if (step.infographicType && (step.id >= 6 && step.id <= 9)) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        position: 'fixed' as const,
        zIndex: 30000
      };
    }
    
    // For steps 3 and 4 - position in center for consistency
    if (step.id === 3 || step.id === 4) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        position: 'fixed' as const
      };
    }
    
    // For other steps, attempt to position based on target elements
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      position: 'fixed' as const
    };
  };
  
  // Determine whether to show premium badge (steps 5-9)
  const shouldShowPremiumBadge = step.id >= 5 && step.id <= 9;
  
  return (
    <motion.div
      ref={stepRef}
      className="tutorial-step-container rounded-xl p-4"
      style={{
        ...getPositionStyle(),
        ...getBackgroundStyle(),
        ...getContainerWidth(),
        border: '3px solid var(--color-theme)',
        boxShadow: '0 0 30px rgba(0, 0, 0, 0.7)',
        zIndex: 30000, // Consistently high z-index for all steps
        pointerEvents: 'auto'
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ 
        duration: 0.4,
        delay: shouldShowInfographic ? 0.1 : 0, // Slight delay for infographic steps
        ease: "easeOut"
      }}
      onClick={(e) => e.stopPropagation()} // Prevent clicks from reaching elements behind
      data-step={step.id} // Add data attribute for easier CSS targeting
      key={`step-${step.id}-${renderKey}`} // Add render key for stability
    >
      {/* Step indicator */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <div className="bg-theme text-white text-xs px-2 py-1 rounded-md">
            <TranslatableText 
              text={`Step ${stepNumber} of ${totalSteps}`} 
              forceTranslate={true}
              className="text-white" 
            />
          </div>
          {shouldShowPremiumBadge && (
            <PremiumBadge className="ml-2" />
          )}
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
      <h3 className="text-lg font-semibold mb-1 text-white">
        <TranslatableText 
          text={step.title} 
          forceTranslate={true}
          className="text-white font-semibold"
          style={{ textShadow: '0 0 4px rgba(0, 0, 0, 0.8)' }}
        />
      </h3>
      
      {/* Content */}
      <p className="text-sm text-white/80 mb-4">
        <TranslatableText 
          text={step.content} 
          forceTranslate={true}
          className="text-white/80"
          style={{ textShadow: '0 0 4px rgba(0, 0, 0, 0.8)' }}
        />
      </p>
      
      {/* Enhanced Infographic with proper mounting and stability */}
      {shouldShowInfographic && step.infographicType && isInfographicMounted && (
        <div className="mb-4 tutorial-infographic-container" style={{ minHeight: '160px' }}>
          <TutorialInfographic 
            type={step.infographicType} 
            key={`infographic-${step.id}-${renderKey}`}
            className="tutorial-infographic-content"
          />
        </div>
      )}
      
      {/* Show loading placeholder for infographics that haven't mounted yet */}
      {shouldShowInfographic && !isInfographicMounted && (
        <div className="mb-4 flex items-center justify-center bg-gray-800/50 rounded-lg" style={{ minHeight: '160px' }}>
          <div className="text-white/60 text-sm">
            <TranslatableText text="Loading visualization..." forceTranslate={true} />
          </div>
        </div>
      )}
      
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
              backgroundColor: "rgba(51,51,51,0.8)",  // More opaque background for all steps
              borderColor: "rgba(255,255,255,0.5)"
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            <TranslatableText 
              text="Back" 
              forceTranslate={true} 
              className="text-white"
            />
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
            style={{ 
              cursor: 'pointer', 
              position: 'relative', 
              zIndex: 30001,
              backgroundColor: 'var(--color-theme)',
              opacity: 1  // Ensure buttons remain fully opaque
            }}
          >
            <TranslatableText 
              text={isLast ? 'Finish' : 'Next'} 
              forceTranslate={true}
              className="text-white" 
            />
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default TutorialStep;
