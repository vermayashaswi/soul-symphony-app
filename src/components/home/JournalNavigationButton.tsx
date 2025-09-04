import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTutorial } from '@/contexts/TutorialContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { showTranslatedToast, showTutorialToast, registerComponent, unregisterComponent } from '@/services/unifiedNotificationService';
import { getAnimationCenterStyles } from '@/utils/arrow-positioning';
import ButtonStateManager from './ButtonStateManager';

const JournalNavigationButton: React.FC = () => {
  const navigate = useNavigate();
  const { isActive, currentStep, steps } = useTutorial();
  const { translate } = useTranslation();
  const buttonRef = useRef<HTMLDivElement>(null);
  const componentId = useRef(`journal-nav-${Date.now()}`);
  const isMountedRef = useRef(true);
  
  // Check if we're in tutorial step 2
  const isInArrowTutorialStep = isActive && steps[currentStep]?.id === 2;

  // Register component on mount and cleanup on unmount
  useEffect(() => {
    registerComponent(componentId.current);
    isMountedRef.current = true;
    
    console.log('[JournalNavigationButton] Component mounted', {
      isActive,
      currentStep,
      isInArrowTutorialStep,
      stepId: steps[currentStep]?.id
    });
    
    return () => {
      isMountedRef.current = false;
      unregisterComponent(componentId.current);
      console.log('[JournalNavigationButton] Component unmounted');
    };
  }, []);

  const navigateToJournal = async () => {
    // Safety check - don't proceed if component is unmounted
    if (!isMountedRef.current) {
      console.log('[JournalNavigationButton] Navigation cancelled - component unmounted');
      return;
    }

    try {
      console.log('[JournalNavigationButton] Navigating to journal page');
      navigate('/app/journal');
      
      // Show a success toast - use tutorial toast if in tutorial mode
      if (isActive) {
        showTutorialToast(
          "Journal", 
          "Opening your journal space",
          componentId.current
        );
      } else {
        // Use translated toast for regular navigation
        await showTranslatedToast(
          "navigation.journal",
          "toasts.openingJournalSpace",
          translate,
          3000,
          undefined,
          componentId.current
        );
      }
    } catch (error) {
      console.error("[JournalNavigationButton] Navigation error:", error);
      
      // Only show error toast if component is still mounted
      if (isMountedRef.current) {
        await showTranslatedToast(
          "toasts.error",
          "toasts.navigationError",
          translate,
          5000,
          undefined,
          componentId.current
        );
      }
    }
  };

  // Don't render if component should be unmounted
  if (!isMountedRef.current) {
    return null;
  }

  return (
    <>
      {/* Button State Manager handles all tutorial state logic */}
      <ButtonStateManager 
        buttonRef={buttonRef}
        isInArrowTutorialStep={isInArrowTutorialStep}
      />
      
      <div 
        className="journal-arrow-button"
        style={{
          ...getAnimationCenterStyles(undefined, undefined, true, 1.07),
          zIndex: isInArrowTutorialStep ? 26000 : 10,
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
          className="rounded-full bg-primary/30 blur-md z-0"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{
            scale: isInArrowTutorialStep ? [1, 1.4, 1] : [1, 1.15, 1],
            opacity: isInArrowTutorialStep ? [0.6, 1, 0.6] : [0.5, 0.8, 0.5]
          }}
          transition={{
            repeat: Infinity,
            duration: isInArrowTutorialStep ? 1 : 2,
            ease: "easeInOut"
          }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: "calc(100% + 20px)",
            height: "calc(100% + 20px)",
          }}
        />
        <motion.button
          onClick={navigateToJournal}
          className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg relative z-20"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <ArrowRight className="text-primary-foreground h-8 w-8" />
        </motion.button>
      </div>
    </>
  );
};

export default JournalNavigationButton;
