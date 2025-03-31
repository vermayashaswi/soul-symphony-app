
import React from 'react';
import { motion } from 'framer-motion';
import { OnboardingLayout } from './OnboardingLayout';
import { useOnboarding } from '@/contexts/OnboardingContext';

interface OnboardingJournalBenefitsProps {
  onContinue: () => void;
  onBack: () => void;
}

export function OnboardingJournalBenefits({ onContinue, onBack }: OnboardingJournalBenefitsProps) {
  const { userName, currentStep } = useOnboarding();
  
  return (
    <OnboardingLayout
      onContinue={onContinue}
      onBack={onBack}
      currentStep={currentStep}
    >
      <div className="flex flex-col items-center text-center h-full">
        <motion.div
          className="mb-6"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="w-48 h-48 relative">
            <img 
              src="/lovable-uploads/dcf66930-3ce1-4da4-bb32-9436079e9927.png" 
              alt="Character meditating"
              className="w-full h-full object-contain" 
            />
          </div>
        </motion.div>
        
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-lg text-primary">
            {userName ? `${userName}, let's make this even better! ✨` : `Let's make this even better! ✨`}
          </p>
          
          <h1 className="text-2xl font-semibold leading-tight">
            With guided prompts and challenges, SOULo helps you notice the small, everyday joys of life.
          </h1>
        </motion.div>
      </div>
    </OnboardingLayout>
  );
}
