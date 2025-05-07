
import React from 'react';
import { motion } from 'framer-motion';
import { tutorialSteps } from '@/contexts/TutorialContext';
import { useTutorial } from '@/contexts/TutorialContext';

export const TutorialOverlay: React.FC = () => {
  const { currentStep } = useTutorial();
  const currentTarget = tutorialSteps[currentStep]?.target;
  
  // Style for the overlay
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9000,
    pointerEvents: 'none',
  };

  return (
    <motion.div
      style={overlayStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    />
  );
};
