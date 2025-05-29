
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
        backgroundColor: 'rgba(26, 31, 44, 0.95)', // Slightly transparent for step 5 to show chat behind
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
    
    // For step 5 - position at bottom right to show chat interface behind
    if (step.id === 5) {
      return {
        bottom: '20px',  // Position at bottom
        right: '20px',   // Position at right
        transform: 'none', // No transform needed
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
  
  // Determine whether to show the infographic and which type
  const shouldShowInfographic = !!step.infographicType && step.id >= 6 && step.id <= 9;
  
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
      transition={{ duration: 0.3 }}
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
      
      {/* Custom Infographic - only show for steps that include infographics */}
      {shouldShowInfographic && step.infographicType && (
        <div className="mb-4">
          <TutorialInfographic type={step.infographicType} />
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
