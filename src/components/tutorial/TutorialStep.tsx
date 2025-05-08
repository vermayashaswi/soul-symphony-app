
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Progress } from '@/components/ui/progress';

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
      className="bg-card border shadow-lg rounded-lg p-6 relative"
      style={{ maxWidth: '350px', zIndex: 10001 }}
    >
      {/* Close button */}
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-8 w-8 p-0 rounded-full absolute top-4 right-4" 
        onClick={onSkip}
        aria-label="Skip tutorial"
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Progress bar */}
      <div className="mb-6 mt-2">
        <Progress value={(step / totalSteps) * 100} className="h-2" />
        <div className="flex justify-between mt-1">
          <div className="text-xs text-muted-foreground">
            <TranslatableText text={`Step ${step}`} />
          </div>
          <div className="text-xs text-muted-foreground">
            <TranslatableText text={`${step}/${totalSteps}`} />
          </div>
        </div>
      </div>
      
      {/* Content */}
      <h3 className="text-lg font-bold mb-3">
        <TranslatableText text={title} />
      </h3>
      <p className="text-muted-foreground mb-6">
        <TranslatableText text={description} />
      </p>
      
      {/* Navigation buttons */}
      <div className="flex justify-between mt-5">
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
          <TranslatableText text={isLastStep ? "Finish" : "Next"} />
          {!isLastStep && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </motion.div>
  );
};

export default TutorialStep;
