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
  
  // Get background color based on step ID - UPDATED for step 5 transparency
  const getBackgroundStyle = () => {
    // Step 5 should be COMPLETELY TRANSPARENT to show Soul-Net behind it
    if (step.id === 5) {
      return {
        backgroundColor: 'transparent', // Completely transparent background
        border: 'none', // Remove border that might create visual artifacts
        boxShadow: 'none', // Remove box shadow
        backdropFilter: 'none', // Remove blur effects
        color: 'white',
        textShadow: '0 0 8px rgba(0, 0, 0, 1)' // Strong black text shadow for maximum readability
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
    
    // All other steps have semi-transparent background with blur
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
        top: '15%',
        left: '50%',
        transform: 'translate(-50%, 0)',
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
        // Override border and shadow for step 5 - make completely invisible
        ...(step.id === 5 ? {
          border: 'none',
          boxShadow: 'none',
          background: 'transparent'
        } : {
          border: '3px solid var(--color-theme)',
          boxShadow: '0 0 30px rgba(0, 0, 0, 0.7)'
        }),
        zIndex: 30000,
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
          <div 
            className="bg-theme text-white text-xs px-2 py-1 rounded-md"
            style={step.id === 5 ? {
              backgroundColor: 'rgba(var(--primary-h), var(--primary-s), var(--primary-l), 0.9)',
              textShadow: '0 0 6px rgba(0, 0, 0, 1)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            } : {}}
          >
            <TranslatableText 
              text={`Step ${stepNumber} of ${totalSteps}`} 
              forceTranslate={true}
              className="text-white" 
              style={step.id === 5 ? { textShadow: '0 0 6px rgba(0, 0, 0, 1)' } : {}}
            />
          </div>
          {shouldShowPremiumBadge && (
            <PremiumBadge 
              className="ml-2" 
              style={step.id === 5 ? {
                textShadow: '0 0 6px rgba(0, 0, 0, 1)',
                backgroundColor: 'rgba(var(--primary-h), var(--primary-s), var(--primary-l), 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              } : {}}
            />
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0 text-white hover:text-white/90" 
          onClick={handleSkip}
          style={step.id === 5 ? {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            textShadow: '0 0 6px rgba(0, 0, 0, 1)',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          } : {}}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Title */}
      <h3 
        className="text-lg font-semibold mb-1 text-white"
        style={step.id === 5 ? { textShadow: '0 0 8px rgba(0, 0, 0, 1)' } : { textShadow: '0 0 4px rgba(0, 0, 0, 0.8)' }}
      >
        <TranslatableText 
          text={step.title} 
          forceTranslate={true}
          className="text-white font-semibold"
          style={step.id === 5 ? { textShadow: '0 0 8px rgba(0, 0, 0, 1)' } : { textShadow: '0 0 4px rgba(0, 0, 0, 0.8)' }}
        />
      </h3>
      
      {/* Content */}
      <p 
        className="text-sm text-white/80 mb-4"
        style={step.id === 5 ? { textShadow: '0 0 8px rgba(0, 0, 0, 1)', color: 'white' } : { textShadow: '0 0 4px rgba(0, 0, 0, 0.8)' }}
      >
        <TranslatableText 
          text={step.content} 
          forceTranslate={true}
          className={step.id === 5 ? "text-white" : "text-white/80"}
          style={step.id === 5 ? { textShadow: '0 0 8px rgba(0, 0, 0, 1)' } : { textShadow: '0 0 4px rgba(0, 0, 0, 0.8)' }}
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
            style={step.id === 5 ? {
              color: "#FFFFFF !important",
              backgroundColor: "rgba(51,51,51,0.9)",
              borderColor: "rgba(255,255,255,0.7)",
              textShadow: "0 0 6px rgba(0, 0, 0, 1)",
              border: "2px solid rgba(255, 255, 255, 0.5)"
            } : {
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
              style={step.id === 5 ? { textShadow: '0 0 6px rgba(0, 0, 0, 1)' } : {}}
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
            style={step.id === 5 ? { 
              cursor: 'pointer', 
              position: 'relative', 
              zIndex: 30001,
              backgroundColor: 'var(--color-theme)',
              opacity: 1,
              textShadow: '0 0 6px rgba(0, 0, 0, 1)',
              border: '2px solid rgba(255, 255, 255, 0.3)'
            } : { 
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
              style={step.id === 5 ? { textShadow: '0 0 6px rgba(0, 0, 0, 1)' } : {}}
            />
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default TutorialStep;
