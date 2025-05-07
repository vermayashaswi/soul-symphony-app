
import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTutorial } from '@/contexts/TutorialContext';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [arrowPoints, setArrowPoints] = useState<{x1: number, y1: number, x2: number, y2: number} | null>(null);

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
    
    // Try finding by data-tutorial attribute first
    element = document.querySelector(`[data-tutorial="${tutorialTarget}"]`) as HTMLElement;
    
    // If not found by data attribute, try by ID
    if (!element) {
      element = document.getElementById(tutorialTarget);
    }
    
    // If still not found, check specific cases based on the step
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
        case 'microphone-button':
          element = document.querySelector('.voice-recorder-button') as HTMLElement;
          if (!element) {
            // Try alternate selectors for the microphone button
            const candidates = [
              '.voice-recorder-container button',
              '[aria-label="Record"]',
              '.recording-button-container button'
            ];
            
            for (const selector of candidates) {
              const el = document.querySelector(selector);
              if (el) {
                element = el as HTMLElement;
                break;
              }
            }
          }
          break;
        default:
          break;
      }
    }
    
    if (element) {
      console.log(`Found target element for ${tutorialTarget}:`, element);
    } else {
      console.warn(`Could not find target element for ${tutorialTarget}`);
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
      setArrowPoints(null);
      return;
    }

    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = tooltipRef.current?.offsetWidth || 300;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 200;
    
    // Calculate position based on target position parameter
    let newPosition = { top: 0, left: 0 };
    let arrow = { x1: 0, y1: 0, x2: 0, y2: 0 };
    
    switch (targetPosition) {
      case 'top':
        newPosition = {
          left: rect.left + rect.width / 2 - tooltipWidth / 2,
          top: rect.top - tooltipHeight - 20 // Add extra space for arrow
        };
        
        // Arrow points from bottom of tooltip to top of element
        arrow = {
          x1: tooltipWidth / 2,
          y1: tooltipHeight,
          x2: tooltipWidth / 2,
          y2: tooltipHeight + 20
        };
        break;
      
      case 'bottom':
        newPosition = {
          left: rect.left + rect.width / 2 - tooltipWidth / 2,
          top: rect.bottom + 20 // Add space for arrow
        };
        
        // Arrow points from top of tooltip to bottom of element
        arrow = {
          x1: tooltipWidth / 2,
          y1: 0,
          x2: tooltipWidth / 2,
          y2: -20
        };
        break;
      
      case 'left':
        newPosition = {
          left: rect.left - tooltipWidth - 20, // Add space for arrow
          top: rect.top + rect.height / 2 - tooltipHeight / 2
        };
        
        // Arrow points from right of tooltip to left of element
        arrow = {
          x1: tooltipWidth,
          y1: tooltipHeight / 2,
          x2: tooltipWidth + 20,
          y2: tooltipHeight / 2
        };
        break;
      
      case 'right':
        newPosition = {
          left: rect.right + 20, // Add space for arrow
          top: rect.top + rect.height / 2 - tooltipHeight / 2
        };
        
        // Arrow points from left of tooltip to right of element
        arrow = {
          x1: 0,
          y1: tooltipHeight / 2,
          x2: -20,
          y2: tooltipHeight / 2
        };
        break;
        
      default:
        // Default to bottom position if not specified
        newPosition = {
          left: rect.left + rect.width / 2 - tooltipWidth / 2,
          top: rect.bottom + 20
        };
        
        arrow = {
          x1: tooltipWidth / 2,
          y1: 0,
          x2: tooltipWidth / 2,
          y2: -20
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
    setArrowPoints(arrow);
  }, [targetElement, targetPosition, tutorialTarget, windowSize]);

  // Apply highlight to target element
  useEffect(() => {
    if (!targetElement || tutorialTarget === 'full-screen') return;
    
    // Create overlay if it doesn't exist
    let overlay = document.getElementById('tutorial-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'tutorial-overlay';
      document.body.appendChild(overlay);
    }
    
    // Style the overlay to cover the whole screen with a semi-transparent background
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '999';
    overlay.style.pointerEvents = 'none'; // Allow clicking through
    
    // Position and style for the target element
    const rect = targetElement.getBoundingClientRect();
    
    // Cut a hole in the overlay for the target element
    overlay.style.boxShadow = `0 0 0 9999px rgba(0, 0, 0, 0.5)`;
    overlay.style.clipPath = `polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 
      0% 0%, 
      ${rect.left - 10}px ${rect.top - 10}px, 
      ${rect.left - 10}px ${rect.bottom + 10}px, 
      ${rect.right + 10}px ${rect.bottom + 10}px, 
      ${rect.right + 10}px ${rect.top - 10}px, 
      ${rect.left - 10}px ${rect.top - 10}px, 
      0% 0%
    )`;
    
    // Add highlight styles to the target element
    targetElement.style.position = 'relative';
    targetElement.style.zIndex = '1000';
    targetElement.style.boxShadow = '0 0 0 4px rgba(var(--primary), 0.7), 0 0 10px rgba(var(--primary), 0.5)';
    targetElement.style.borderRadius = '4px';
    targetElement.style.transition = 'box-shadow 0.3s ease';
    
    return () => {
      // Remove overlay and highlight styles
      if (overlay) {
        document.body.removeChild(overlay);
      }
      
      targetElement.style.boxShadow = '';
      targetElement.style.zIndex = '';
      targetElement.style.position = '';
      targetElement.style.borderRadius = '';
      targetElement.style.transition = '';
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
              <TranslatableText text="This is your Journal page! Here you can record your thoughts and feelings by tapping the microphone button in the center. Try making your first entry!" />
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
              <TranslatableText text="The Insights tab shows visualizations of your emotional patterns and themes over time. The more journal entries you create, the richer your insights will be!" />
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
              <TranslatableText text="The Chat tab lets you have conversations with Ruh about your journal entries and emotional patterns. Ask questions about your feelings or get advice!" />
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
              <TranslatableText text="The Settings tab lets you customize your experience, update your profile information, and manage your account preferences." />
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
              <TranslatableText text="You've completed the tour! You're now ready to start your journaling journey with SOULo. Remember, you can revisit this tutorial anytime from the Settings page." />
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
        transition={{ duration: 0.3, ease: "easeInOut" }}
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
        {/* Arrow connecting tooltip to target element */}
        {arrowPoints && (
          <svg 
            className="absolute pointer-events-none" 
            style={{
              width: '100%',
              height: '100%',
              top: 0,
              left: 0,
              overflow: 'visible'
            }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="0"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="currentColor"
                  className="text-primary"
                />
              </marker>
            </defs>
            <line
              x1={arrowPoints.x1}
              y1={arrowPoints.y1}
              x2={arrowPoints.x2}
              y2={arrowPoints.y2}
              stroke="currentColor"
              strokeWidth="2"
              className="text-primary"
              markerEnd="url(#arrowhead)"
            />
          </svg>
        )}
        
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
        
        <motion.div 
          className="tutorial-content"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          {getStepContent()}
        </motion.div>
        
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
