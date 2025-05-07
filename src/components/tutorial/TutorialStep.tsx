
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface TutorialStepProps {
  step: number;
  totalSteps: number;
  title: string;
  description: string;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

const TutorialStep: React.FC<TutorialStepProps> = ({
  step,
  totalSteps,
  title,
  description,
  onNext,
  onPrevious,
  onSkip,
  isFirstStep,
  isLastStep
}) => {
  return (
    <motion.div
      className="bg-card border shadow-lg rounded-lg p-6 max-w-md relative"
      style={{ maxWidth: '350px' }}
    >
      {/* Step indicator */}
      <div className="flex justify-between items-center mb-2">
        <div className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center font-bold">
          {step}
        </div>
        <div className="text-sm text-muted-foreground">
          <TranslatableText text={`${step}/${totalSteps}`} />
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0 rounded-full" 
          onClick={onSkip}
          aria-label="Skip tutorial"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Content */}
      <h3 className="text-lg font-bold mb-2">
        <TranslatableText text={title} />
      </h3>
      <p className="text-muted-foreground mb-4">
        <TranslatableText text={description} />
      </p>
      
      {/* Navigation buttons */}
      <div className="flex justify-between mt-4">
        {!isFirstStep ? (
          <Button 
            variant="outline"
            size="sm"
            onClick={onPrevious}
            className="flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            <TranslatableText text="Previous" />
          </Button>
        ) : (
          <div></div>
        )}
        
        <Button 
          variant="default"
          size="sm"
          onClick={onNext}
          className="flex items-center gap-1"
        >
          <TranslatableText text={isLastStep ? "Finish" : "Got it"} />
          {!isLastStep && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </motion.div>
  );
};

export default TutorialStep;
