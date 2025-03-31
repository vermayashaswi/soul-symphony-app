
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { OnboardingWelcome } from './OnboardingWelcome';
import { OnboardingUserName } from './OnboardingUserName';
import { OnboardingJournalBenefits } from './OnboardingJournalBenefits';
import { OnboardingBenefits } from './OnboardingBenefits';
import { OnboardingFocusAreas } from './OnboardingFocusAreas';
import { OnboardingReminders } from './OnboardingReminders';
import { OnboardingComplete } from './OnboardingComplete';

export function OnboardingFlow() {
  const { currentStep, setCurrentStep } = useOnboarding();

  const handleContinue = () => {
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(Math.max(0, currentStep - 1));
  };

  // Define the steps in the onboarding flow
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <OnboardingWelcome onContinue={handleContinue} />;
      case 1:
        return <OnboardingUserName onContinue={handleContinue} onBack={handleBack} />;
      case 2:
        return <OnboardingJournalBenefits onContinue={handleContinue} onBack={handleBack} />;
      case 3:
        return <OnboardingBenefits onContinue={handleContinue} onBack={handleBack} />;
      case 4:
        return <OnboardingFocusAreas onContinue={handleContinue} onBack={handleBack} />;
      case 5:
        return <OnboardingReminders onContinue={handleContinue} onBack={handleBack} />;
      case 6:
        return <OnboardingComplete />;
      default:
        return <OnboardingWelcome onContinue={handleContinue} />;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -100 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-background dark:bg-black"
      >
        {renderStep()}
      </motion.div>
    </AnimatePresence>
  );
}
