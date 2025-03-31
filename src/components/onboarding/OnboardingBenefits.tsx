
import React from 'react';
import { motion } from 'framer-motion';
import { OnboardingLayout } from './OnboardingLayout';
import { useOnboarding } from '@/contexts/OnboardingContext';

interface OnboardingBenefitsProps {
  onContinue: () => void;
  onBack: () => void;
}

export function OnboardingBenefits({ onContinue, onBack }: OnboardingBenefitsProps) {
  const { userName, currentStep } = useOnboarding();
  
  const benefits = [
    {
      title: "Become Happier",
      description: "You'll start appreciating little blessings and find more and more things to be grateful for.",
      icon: "😄"
    },
    {
      title: "Think Positively",
      description: "You'll find it easier to look at the brighter side of life and support yourself in difficulties.",
      icon: "😇"
    },
    {
      title: "Sleep Better",
      description: "You'll grow to worry less, be more optimistic, and live in the present moment.",
      icon: "😴"
    }
  ];
  
  return (
    <OnboardingLayout
      onContinue={onContinue}
      onBack={onBack}
      currentStep={currentStep}
    >
      <div className="flex flex-col h-full space-y-6">
        <motion.h1
          className="text-2xl font-bold"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Just 5 minutes of daily journaling will help you,
        </motion.h1>
        
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, staggerChildren: 0.1 }}
        >
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              className="flex items-start gap-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + (index * 0.1) }}
            >
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center shrink-0">
                <span className="text-2xl">{benefit.icon}</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </OnboardingLayout>
  );
}
