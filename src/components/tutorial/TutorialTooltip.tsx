
import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTutorial } from '@/contexts/TutorialContext';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ArrowLeft, ArrowRight, XCircle } from 'lucide-react';

interface TutorialTooltipProps {
  open: boolean;
}

const TutorialTooltip: React.FC<TutorialTooltipProps> = ({ open }) => {
  const { 
    currentStep, 
    nextStep, 
    previousStep, 
    skipTutorial, 
    tutorialProgress, 
    tutorialTarget,
    targetPosition
  } = useTutorial();
  
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // Handle resize events
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Find the target element based on tutorial target
  useEffect(() => {
    if (!open) return;

    if (tutorialTarget === 'full-screen') {
      setTargetElement(null);
      return;
    }

    let element: HTMLElement | null = null;
    
    // Find element by data-tutorial attribute or ID
    element = document.querySelector(`[data-tutorial="${tutorialTarget}"]`) as HTMLElement;
    
    // If not found by data attribute, try by ID
    if (!element) {
      element = document.getElementById(tutorialTarget);
    }
    
    // If still not found, check specific cases
    if (!element) {
      switch (tutorialTarget) {
        case 'journal-button':
          element = document.querySelector('[href="/app/journal"]') as HTMLElement;
          break;
        case 'insights-button':
          element = document.querySelector('[href="/app/insights"]') as HTMLElement;
          break;
        case 'chat-button':
          element = document.querySelector('[href="/app/chat"]') as HTMLElement;
          break;
        case 'settings-button':
          element = document.querySelector('[href="/app/settings"]') as HTMLElement;
          break;
        default:
          break;
      }
    }
    
    setTargetElement(element);
  }, [tutorialTarget, open, windowSize]);

  // Calculate position relative to target element
  useEffect(() => {
    if (!targetElement || tutorialTarget === 'full-screen') {
      // Center in screen for full-screen targets
      setPosition({
        left: windowSize.width / 2 - (tooltipRef.current?.offsetWidth || 300) / 2,
        top: windowSize.height / 2 - (tooltipRef.current?.offsetHeight || 200) / 2
      });
      return;
    }

    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = tooltipRef.current?.offsetWidth || 300;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 200;
    
    // Calculate position based on target position parameter
    let newPosition = { top: 0, left: 0 };
    
    switch (targetPosition) {
      case 'top':
        newPosition = {
          left: rect.left + rect.width / 2 - tooltipWidth / 2,
          top: rect.top - tooltipHeight - 10
        };
        break;
      case 'bottom':
        newPosition = {
          left: rect.left + rect.width / 2 - tooltipWidth / 2,
          top: rect.bottom + 10
        };
        break;
      case 'left':
        newPosition = {
          left: rect.left - tooltipWidth - 10,
          top: rect.top + rect.height / 2 - tooltipHeight / 2
        };
        break;
      case 'right':
        newPosition = {
          left: rect.right + 10,
          top: rect.top + rect.height / 2 - tooltipHeight / 2
        };
        break;
      default:
        // Default to bottom
        newPosition = {
          left: rect.left + rect.width / 2 - tooltipWidth / 2,
          top: rect.bottom + 10
        };
        break;
    }
    
    // Adjust position to ensure it stays on screen
    if (newPosition.left < 10) newPosition.left = 10;
    if (newPosition.left + tooltipWidth > windowSize.width - 10) {
      newPosition.left = windowSize.width - tooltipWidth - 10;
    }
    if (newPosition.top < 10) newPosition.top = 10;
    if (newPosition.top + tooltipHeight > windowSize.height - 10) {
      newPosition.top = windowSize.height - tooltipHeight - 10;
    }
    
    setPosition(newPosition);
  }, [targetElement, targetPosition, tutorialTarget, windowSize]);

  // Apply highlight to target element
  useEffect(() => {
    if (!targetElement || tutorialTarget === 'full-screen') return;
    
    // Add highlight styles
    targetElement.style.position = 'relative';
    targetElement.style.zIndex = '1000';
    targetElement.style.boxShadow = '0 0 0 4px rgba(var(--primary), 0.7)';
    targetElement.style.borderRadius = '4px';
    
    return () => {
      // Remove highlight styles
      targetElement.style.boxShadow = '';
      targetElement.style.zIndex = '';
      targetElement.style.position = '';
      targetElement.style.borderRadius = '';
    };
  }, [targetElement, tutorialTarget]);

  // Get step-specific content
  const getStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <>
            <h3 className="text-lg font-semibold mb-2">
              <TranslatableText text="Welcome to SOULo!" />
            </h3>
            <p className="mb-4">
              <TranslatableText text="Let's take a quick tour to help you get the most out of your journaling experience." />
            </p>
          </>
        );
      case 'journal':
        return (
          <>
            <h3 className="text-lg font-semibold mb-2">
              <TranslatableText text="Journal" />
            </h3>
            <p className="mb-4">
              <TranslatableText text="The Journal tab is where you record and review your thoughts and feelings. Tap the microphone button to start recording your thoughts." />
            </p>
          </>
        );
      case 'insights':
        return (
          <>
            <h3 className="text-lg font-semibold mb-2">
              <TranslatableText text="Insights" />
            </h3>
            <p className="mb-4">
              <TranslatableText text="The Insights tab shows visualizations of your emotional patterns and themes over time." />
            </p>
          </>
        );
      case 'chat':
        return (
          <>
            <h3 className="text-lg font-semibold mb-2">
              <TranslatableText text="Chat" />
            </h3>
            <p className="mb-4">
              <TranslatableText text="The Chat tab lets you have conversations with Ruh about your journal entries and emotional patterns." />
            </p>
          </>
        );
      case 'settings':
        return (
          <>
            <h3 className="text-lg font-semibold mb-2">
              <TranslatableText text="Settings" />
            </h3>
            <p className="mb-4">
              <TranslatableText text="The Settings tab lets you customize your experience and manage your account." />
            </p>
          </>
        );
      case 'complete':
        return (
          <>
            <h3 className="text-lg font-semibold mb-2">
              <TranslatableText text="Congratulations!" />
            </h3>
            <p className="mb-4">
              <TranslatableText text="You're all set to start your journaling journey. Remember, you can revisit this tutorial anytime from the Settings page." />
            </p>
          </>
        );
      default:
        return null;
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={tooltipRef}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          zIndex: 1100,
          width: tutorialTarget === 'full-screen' ? '80%' : '300px',
          maxWidth: '500px',
        }}
        className="bg-card border rounded-lg shadow-lg p-4 tutorial-tooltip"
      >
        <div className="text-right mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={skipTutorial}
          >
            <XCircle className="h-4 w-4" />
            <span className="sr-only">
              <TranslatableText text="Skip" />
            </span>
          </Button>
        </div>
        
        <div className="tutorial-content">
          {getStepContent()}
        </div>
        
        <div className="mt-4">
          <Progress value={tutorialProgress} className="h-1 mb-3" />
          
          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={previousStep}
              disabled={currentStep === 'welcome'}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              <TranslatableText text="Previous" />
            </Button>
            
            <Button
              variant="default"
              size="sm"
              onClick={nextStep}
            >
              {currentStep === 'complete' ? (
                <TranslatableText text="Finish" />
              ) : (
                <>
                  <TranslatableText text="Next" />
                  <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TutorialTooltip;
