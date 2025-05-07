
import React, { useEffect, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import { tutorialSteps } from '@/contexts/TutorialContext';

interface TutorialStepProps {
  step: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onComplete: () => void;
  onSkip: () => void;
}

export const TutorialStep: React.FC<TutorialStepProps> = ({
  step,
  totalSteps,
  onNext,
  onPrevious,
  onComplete,
  onSkip
}) => {
  const [open, setOpen] = useState(true);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  
  const currentStep = tutorialSteps[step];
  const isFirstStep = step === 0;
  const isLastStep = step === totalSteps - 1;
  
  // Find the target element for this step
  useEffect(() => {
    const element = document.querySelector(currentStep.target) as HTMLElement;
    setTargetElement(element);
    
    if (element) {
      // Scroll element into view with smooth behavior
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Add highlight class to the element
      element.classList.add('tutorial-highlight');
      
      // Clean up when step changes
      return () => {
        element.classList.remove('tutorial-highlight');
      };
    }
  }, [step, currentStep.target]);
  
  // Handle case where target element doesn't exist
  if (!targetElement) {
    console.warn(`Tutorial target element not found: ${currentStep.target}`);
    return null;
  }
  
  const handleComplete = () => {
    setOpen(false);
    setTimeout(onComplete, 200);
  };
  
  const handleNext = () => {
    setOpen(false);
    setTimeout(onNext, 200);
  };
  
  const handlePrevious = () => {
    setOpen(false);
    setTimeout(onPrevious, 200);
  };
  
  const handleSkip = () => {
    setOpen(false);
    setTimeout(onSkip, 200);
  };

  return (
    <Tooltip.Provider>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger asChild>
          <span className="sr-only">Tutorial step {step + 1}</span>
        </Tooltip.Trigger>
        <AnimatePresence>
          {open && (
            <Tooltip.Portal forceMount>
              <Tooltip.Content
                side={currentStep.placement as any}
                align="center"
                sideOffset={5}
                className="z-[9999]"
                asChild
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-background border border-border p-4 rounded-lg shadow-lg max-w-xs"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-lg">
                      {currentStep.title}
                    </h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={handleSkip}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-4">
                    {currentStep.content}
                  </p>
                  
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-muted-foreground">
                      {step + 1} of {totalSteps}
                    </div>
                    <div className="flex space-x-2">
                      {!isFirstStep && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handlePrevious}
                          className="flex items-center"
                        >
                          <ChevronLeft size={16} className="mr-1" />
                          Back
                        </Button>
                      )}
                      
                      {isLastStep ? (
                        <Button
                          size="sm"
                          onClick={handleComplete}
                          className="flex items-center"
                        >
                          Finish
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={handleNext}
                          className="flex items-center"
                        >
                          Next
                          <ChevronRight size={16} className="ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              </Tooltip.Content>
            </Tooltip.Portal>
          )}
        </AnimatePresence>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
