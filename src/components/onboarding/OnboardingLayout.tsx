
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  onContinue: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  continueText?: string;
  hideProgress?: boolean;
  currentStep?: number;
  totalSteps?: number;
}

export function OnboardingLayout({
  children,
  onContinue,
  onBack,
  showBackButton = true,
  continueText = "Continue",
  hideProgress = false,
  currentStep = 0,
  totalSteps = 5
}: OnboardingLayoutProps) {
  return (
    <motion.div 
      className="flex flex-col min-h-screen bg-background dark:bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <header className="pt-12 px-4">
        {showBackButton && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="mb-4"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
        )}
        
        {!hideProgress && (
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-2">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
        )}
      </header>
      
      <main className="flex-1 flex flex-col p-6">
        <div className="flex-1 flex flex-col justify-center">
          {children}
        </div>
      </main>
      
      <footer className="p-6 pb-10">
        <Button 
          className="w-full h-14 text-lg rounded-full bg-pink-500 hover:bg-pink-600"
          onClick={onContinue}
        >
          {continueText}
        </Button>
      </footer>
    </motion.div>
  );
}
