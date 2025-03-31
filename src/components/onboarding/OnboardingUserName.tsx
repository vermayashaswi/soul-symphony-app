
import React from 'react';
import { motion } from 'framer-motion';
import { OnboardingLayout } from './OnboardingLayout';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';

interface OnboardingUserNameProps {
  onContinue: () => void;
  onBack: () => void;
}

export function OnboardingUserName({ onContinue, onBack }: OnboardingUserNameProps) {
  const { userName, setUserName, currentStep } = useOnboarding();
  
  const handleClearInput = () => {
    setUserName('');
  };
  
  return (
    <OnboardingLayout
      onContinue={onContinue}
      onBack={onBack}
      currentStep={currentStep}
    >
      <div className="flex flex-col items-center justify-center h-full">
        <motion.div
          className="mb-12"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="w-24 h-24">
            <img 
              src="/lovable-uploads/c95292b2-0ced-46cf-8386-2b539d4dce62.png" 
              alt="Flower icon" 
              className="w-full h-full object-contain"
            />
          </div>
        </motion.div>
        
        <motion.div
          className="w-full space-y-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-3xl font-bold text-center">
            What should we call you?
          </h1>
          
          <div className="relative w-full">
            <Input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full h-14 pl-4 pr-12 text-lg border-pink-300 bg-background/5 rounded-full"
              placeholder="Your name"
              autoFocus
            />
            {userName && (
              <button 
                onClick={handleClearInput}
                className="absolute right-4 top-1/2 transform -translate-y-1/2"
              >
                <X className="h-6 w-6 text-muted-foreground" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </OnboardingLayout>
  );
}
