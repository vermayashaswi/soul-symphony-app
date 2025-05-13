
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTutorial } from '@/contexts/TutorialContext';

const JournalNavigationButton: React.FC = () => {
  const navigate = useNavigate();
  const { isActive, currentStep, steps } = useTutorial();
  const buttonRef = useRef<HTMLDivElement>(null);
  
  // Check if we're in tutorial step 2
  const isInArrowTutorialStep = isActive && steps[currentStep]?.id === 2;

  const navigateToJournal = () => {
    try {
      navigate('/app/journal');
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  // Enhanced logging for button positioning - for better debugging
  useEffect(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      console.log('Journal arrow button position:', rect);
      console.log('Journal arrow button center:', {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
      console.log('Viewport center:', {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });
      
      // Calculate offset from viewport center
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const offsetX = centerX - (window.innerWidth / 2);
      const offsetY = centerY - (window.innerHeight / 2);
      console.log('Offset from viewport center:', { x: offsetX, y: offsetY });
    }
  }, []);

  return (
    <div 
      className={`journal-arrow-button ${isInArrowTutorialStep ? 'tutorial-target' : ''}`}
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: isInArrowTutorialStep ? 9990 : 40, // Lower than popup but higher than normal
        margin: 0,
        padding: 0,
        pointerEvents: 'auto',
        visibility: 'visible',
        opacity: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: 'auto',
        height: 'auto',
      }}
      data-testid="journal-arrow-button"
      ref={buttonRef}
    >
      <motion.div
        className={`absolute inset-0 rounded-full bg-primary/30 blur-md z-0 ${
          isInArrowTutorialStep ? 'tutorial-button-outer-glow' : ''
        }`}
        initial={{ scale: 1, opacity: 0.5 }}
        animate={{
          scale: isInArrowTutorialStep ? [1, 1.3, 1] : [1, 1.15, 1],
          opacity: isInArrowTutorialStep ? [0.5, 0.95, 0.5] : [0.5, 0.8, 0.5]
        }}
        transition={{
          repeat: Infinity,
          duration: isInArrowTutorialStep ? 1.2 : 2,
          ease: "easeInOut"
        }}
        style={{
          width: "calc(100% + 20px)",
          height: "calc(100% + 20px)",
          top: "-10px",
          left: "-10px"
        }}
      />
      <motion.button
        onClick={navigateToJournal}
        className={`w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg relative z-20 ${
          isInArrowTutorialStep ? 'tutorial-button-highlight' : ''
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <ArrowRight className="text-primary-foreground h-8 w-8" />
      </motion.button>
    </div>
  );
};

export default JournalNavigationButton;
