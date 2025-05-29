
import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import { TutorialStep as TutorialStepType } from '@/contexts/TutorialContext';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import TutorialInfographic from './TutorialInfographic';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { PremiumBadge } from '@/components/onboarding/PremiumBadge';
import { useViewportAwarePosition } from '@/hooks/useViewportAwarePosition';

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
  
  // Get viewport-aware position
  const position = useViewportAwarePosition({
    stepId: step.id,
    targetElement: step.targetElement
  });
  
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
  
  // Get background color based on step ID
  const getBackgroundStyle = () => {
    // Step 6 should be slightly transparent to show chat behind
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
    
    // Steps 4-5 have semi-transparent background with blur
    if (step.id === 4 || step.id === 5) {
      return {
        backgroundColor: 'rgba(26, 31, 44, 0.2)',
        backdropFilter: 'blur(2px)',
        color: 'white',
        textShadow: '0 0 4px rgba(0, 0, 0, 0.8)'
      };
    }
    
    // Steps 7-10 (insights steps with infographics) should be fully opaque
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
  
  // Determine whether to show the infographic and which type
  const shouldShowInfographic = !!step.infographicType && step.id >= 7 && step.id <= 10;
  
  // Determine whether to show premium badge
  const shouldShowPremiumBadge = step.id >= 6 && step.id <= 10;
  
  return (
    <motion.div
      ref={stepRef}
      className="tutorial-step-container rounded-xl p-4"
      style={{
        position: 'fixed',
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        transform: position.transform,
        maxWidth: position.maxWidth,
        maxHeight: position.maxHeight,
        width: 'auto',
        ...getBackgroundStyle(),
        border: '3px solid var(--color-theme)',
        boxShadow: '0 0 30px rgba(0, 0, 0, 0.7)',
        zIndex: 30000,
        pointerEvents: 'auto',
        overflow: 'auto'
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
