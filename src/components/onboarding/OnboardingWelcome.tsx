
import React from 'react';
import { motion } from 'framer-motion';
import { OnboardingLayout } from './OnboardingLayout';

interface OnboardingWelcomeProps {
  onContinue: () => void;
}

export function OnboardingWelcome({ onContinue }: OnboardingWelcomeProps) {
  return (
    <OnboardingLayout 
      onContinue={onContinue} 
      showBackButton={false} 
      hideProgress={true}
    >
      <div className="flex flex-col items-center text-center space-y-8">
        <motion.div
          className="mb-6"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="w-40 h-40 relative">
            <img 
              src="/lovable-uploads/0d94622c-389e-4316-bee1-4da875b19fbc.png" 
              alt="Hand holding flower" 
              className="w-full h-full object-contain"
            />
          </div>
        </motion.div>
        
        <div className="space-y-6">
          <motion.h1 
            className="text-3xl font-bold"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Your data is private
          </motion.h1>
          
          <motion.ul
            className="text-lg space-y-6 text-left"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <li className="flex items-center gap-3">
              <span className="text-2xl">•</span>
              <span>Your data is private</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-2xl">•</span>
              <span>No log-in required</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-2xl">•</span>
              <span>Full transparency</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-2xl">•</span>
              <span>Ad-free, forever</span>
            </li>
          </motion.ul>
        </div>
      </div>
    </OnboardingLayout>
  );
}
