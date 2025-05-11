
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTutorial } from '@/contexts/TutorialContext';

const JournalNavigationButton: React.FC = () => {
  const navigate = useNavigate();
  const { isActive, currentStep, steps } = useTutorial();
  
  // Check if we're in tutorial step 2
  const isInArrowTutorialStep = isActive && steps[currentStep]?.id === 2;

  const navigateToJournal = () => {
    try {
      navigate('/app/journal');
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  // Special styling for when the tutorial is active
  const buttonWrapperStyle = {
    position: 'absolute',
    top: 'calc(50% - 31px)',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: isInArrowTutorialStep ? 9998 : 40,
    pointerEvents: 'auto',
    visibility: 'visible',
    opacity: 1
  } as React.CSSProperties;

  // Add debug logging to help with positioning
  React.useEffect(() => {
    if (isInArrowTutorialStep) {
      const element = document.querySelector('.journal-arrow-button');
      if (element) {
        console.log('Journal arrow button position:', element.getBoundingClientRect());
      }
    }
  }, [isInArrowTutorialStep]);

  return (
    <div 
      className="journal-arrow-button" 
      style={buttonWrapperStyle}
      data-testid="journal-arrow-button"
    >
      <motion.div
        className="absolute inset-0 rounded-full bg-primary/30 blur-md z-0"
        initial={{ scale: 1, opacity: 0.5 }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.5, 0.8, 0.5]
        }}
        transition={{
          repeat: Infinity,
          duration: 2,
          ease: "easeInOut"
        }}
        style={{
          width: "calc(100% + 16px)",
          height: "calc(100% + 16px)",
          top: "-8px",
          left: "-8px"
        }}
      />
      <motion.button
        onClick={navigateToJournal}
        className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg relative z-20"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <ArrowRight className="text-primary-foreground h-6 w-6" />
      </motion.button>
    </div>
  );
};

export default JournalNavigationButton;
