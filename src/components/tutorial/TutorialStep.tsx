
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
  
  // Improved logging for debugging
  useEffect(() => {
    console.log(`TutorialStep mounted for step ${step.id}, renderKey: ${renderKey}`);
    
    return () => {
      console.log(`TutorialStep unmounted for step ${step.id}`);
    };
  }, [step.id, renderKey]);
  
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
  
  // Get background color based on step ID - Updated for new step 3
  const getBackgroundStyle = () => {
    // Step 6 should be slightly transparent to show chat behind (was step 5)
    if (step.id === 6) {
      return {
        backgroundColor: 'rgba(26, 31, 44, 0.95)',
        color: 'white',
        textShadow: '0 0 4px rgba(0, 0, 0, 0.8)'
      };
    }
    
    // Steps 1 and 2 should be fully opaque
    if (step.id === 1 || step.id === 2) {
      return {
        backgroundColor: 'rgba(26, 31, 44, 1)',
        color: 'white',
        textShadow: '0 0 4px rgba(0, 0, 0, 0.8)'
      };
    }
    
    // Step 3 (theme strips) should be semi-transparent to show strips behind
    if (step.id === 3) {
      return {
        backgroundColor: 'rgba(26, 31, 44, 0.85)',
        color: 'white',
        textShadow: '0 0 4px rgba(0, 0, 0, 0.8)'
      };
    }
    
    // Steps 4-5 have semi-transparent background with blur (previously steps 3-4)
    if (step.id === 4 || step.id === 5) {
      return {
        backgroundColor: 'rgba(26, 31, 44, 0.2)',
        backdropFilter: 'blur(2px)',
        color: 'white',
        textShadow: '0 0 4px rgba(0, 0, 0, 0.8)'
      };
    }
    
    // Steps 7-10 (insights steps with infographics) should be fully opaque (was 6-9)
    if (step.id >= 7 && step.id <= 10) {
      return {
        backgroundColor: 'rgba(26, 31, 44, 1)',
        color: 'white',
        textShadow: '0 0 4px rgba(0, 0, 0, 0.8)'
      };
    }
    
    // Default for any other steps
    return {
      backgroundColor: 'rgba(26, 31, 44, 0.2)',
      backdropFilter: 'blur(2px)',
      color: 'white',
      textShadow: '0 0 4px rgba(0, 0, 0, 0.8)'
    };
  };
  
  // Adjust container width if it has an image
  const getContainerWidth = () => {
    // Make steps with images wider (steps 7-10, was 6-9)
    if (step.infographicType && (step.id >= 7 && step.id <= 10)) {
      return {
        maxWidth: '350px',
        width: 'calc(100% - 40px)'
      };
    }
    
    return {
      maxWidth: '320px',
      width: 'calc(100% - 40px)'
    };
  };
  
  // Improved modal positioning based on step ID - Updated positioning logic
  const getPositionStyle = () => {
    // Special positioning for step 2 to move it to the very top so arrow button is visible
    if (step.id === 2) {
      return {
        top: '10%',
        left: '50%',
        transform: 'translate(-50%, 0)',
        position: 'fixed' as const
      };
    }
    
    // For step 3 (theme strips) - center to show strips around it
    if (step.id === 3) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        position: 'fixed' as const,
        zIndex: 30000
      };
    }
    
    // For step 6 - position at bottom right to show chat interface behind (was step 5)
    if (step.id === 6) {
      return {
        bottom: '20px',
        right: '20px',
        transform: 'none',
        position: 'fixed' as const,
        zIndex: 30000
      };
    }
    
    // For steps with infographics (7-10) - centered to ensure they're visible (was 6-9)
    if (step.infographicType && (step.id >= 7 && step.id <= 10)) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        position: 'fixed' as const,
        zIndex: 30000
      };
    }
    
    // For steps 4 and 5 - position in center for consistency (was 3 and 4)
    if (step.id === 4 || step.id === 5) {
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
  
  // Determine whether to show the infographic and which type - Updated step range
  const shouldShowInfographic = !!step.infographicType && step.id >= 7 && step.id <= 10;
  
  // Determine whether to show premium badge (steps 6-10, was 5-9)
  const shouldShowPremiumBadge = step.id >= 6 && step.id <= 10;
  
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
        zIndex: 30000,
        pointerEvents: 'auto'
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3 }}
      onClick={(e) => e.stopPropagation()}
      data-step={step.id}
      key={`step-${step.id}-${renderKey}`}
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
      
      <h3 className="text-lg font-semibold mb-1 text-white">
        <TranslatableText 
          text={step.title} 
          forceTranslate={true}
          className="text-white font-semibold"
          style={{ textShadow: '0 0 4px rgba(0, 0, 0, 0.8)' }}
        />
      </h3>
      
      <p className="text-sm text-white/80 mb-4">
        <TranslatableText 
          text={step.content} 
          forceTranslate={true}
          className="text-white/80"
          style={{ textShadow: '0 0 4px rgba(0, 0, 0, 0.8)' }}
        />
      </p>
      
      {shouldShowInfographic && step.infographicType && (
        <div className="mb-4">
          <TutorialInfographic type={step.infographicType} />
        </div>
      )}
      
      <div className="flex justify-between mt-2 tutorial-buttons">
        {!isFirst && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePrev}
            className="flex items-center gap-1 pointer-events-auto bg-gray-800 border-white/50 text-white hover:text-white hover:bg-gray-700"
            style={{
              color: "#FFFFFF !important",
              backgroundColor: "rgba(51,51,51,0.8)",
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
              opacity: 1
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
