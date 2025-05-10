
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from '@/contexts/TutorialContext';
import TutorialStep from './TutorialStep';

const TutorialOverlay: React.FC = () => {
  const { 
    isActive, 
    currentStep, 
    totalSteps,
    steps, 
    nextStep, 
    prevStep, 
    skipTutorial
  } = useTutorial();

  if (!isActive) return null;

  const currentTutorialStep = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  // Handle highlighting specific elements
  const targetElement = currentTutorialStep.targetElement;

  return (
    <div className="fixed inset-0 z-[9997] pointer-events-auto">
      {/* Semi-transparent overlay */}
      <motion.div
        className="absolute inset-0 bg-black pointer-events-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.75 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={() => {}}
        style={{ 
          touchAction: 'none', 
          opacity: 0.75 // Fixed 75% opacity as requested
        }}
      />

      {/* Apply special styles to target element if needed */}
      {targetElement && (
        <style dangerouslySetInnerHTML={{
          __html: `
            ${targetElement} {
              position: relative;
              z-index: 9998;
              filter: none;
              pointer-events: auto;
            }
            ${targetElement}::before {
              content: '';
              position: absolute;
              inset: -8px;
              background: radial-gradient(
                circle at center,
                rgba(var(--primary-h), var(--primary-s), var(--primary-l), 0.2) 0%,
                transparent 70%
              );
              border-radius: inherit;
              z-index: -1;
            }
          `
        }} />
      )}

      {/* Tutorial step */}
      <AnimatePresence mode="wait">
        <TutorialStep
          key={currentStep}
          step={currentTutorialStep}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTutorial}
          isFirst={isFirstStep}
          isLast={isLastStep}
          stepNumber={currentStep + 1}
          totalSteps={totalSteps}
        />
      </AnimatePresence>
    </div>
  );
};

export default TutorialOverlay;
