import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWindowSize } from '@/hooks/use-window-size';
import { useAuth } from '@/contexts/AuthContext';
import { useTutorial } from '@/contexts/TutorialContext';
import { Button } from '@/components/ui/button';
import { ChevronRight, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTheme } from '@/hooks/use-theme';
import { toast } from 'sonner';

// Define the steps for the tutorial
const tutorialSteps = [
  {
    id: 1,
    selector: '#journal-entries-container',
    title: 'Welcome to Your Journal',
    description: 'This is where your journal entries will appear. Let\'s start by creating your first entry.',
    position: 'bottom',
  },
  {
    id: 2,
    selector: '#start-recording-button',
    title: 'Start Recording',
    description: 'Click this button to start recording your thoughts. Don\'t worry, you can always edit or delete the entry later.',
    position: 'bottom',
  },
  {
    id: 3,
    selector: '#journal-entry-card-0',
    title: 'Your First Entry',
    description: 'Once you\'ve recorded your entry, it will appear here. Click on the entry to view and edit it.',
    position: 'bottom',
  },
  {
    id: 4,
    selector: '#insights-tab-button',
    title: 'Explore Insights',
    description: 'Click here to explore insights derived from your journal entries. Discover trends and patterns in your thoughts and feelings.',
    position: 'bottom',
  },
  {
    id: 5,
    selector: '#insights-container',
    title: 'Insights Overview',
    description: 'Here you can see an overview of your insights. Click on a specific insight to dive deeper.',
    position: 'bottom',
  },
  {
    id: 6,
    selector: '.chat-ai-response',
    title: 'Meet Rūḥ, Your AI Companion',
    description: 'Rūḥ is here to help you understand your insights. Ask questions about your journal entries and get personalized feedback.',
    position: 'bottom',
  },
  {
    id: 7,
    selector: '#chat-input',
    title: 'Ask Rūḥ Anything',
    description: 'Type your questions here and press enter to get a response from Rūḥ.',
    position: 'top',
  },
  {
    id: 8,
    selector: '#account-button',
    title: 'Manage Your Account',
    description: 'Click here to manage your account settings, including your profile and subscription.',
    position: 'bottom',
  },
  {
    id: 9,
    selector: '#tutorial-button',
    title: 'Restart Tutorial',
    description: 'You can restart this tutorial at any time by clicking here.',
    position: 'bottom',
  },
  {
    id: 10,
    selector: '#app-logo',
    title: 'Welcome to Lovable',
    description: 'You\'re all set! Start exploring your journal and discover the power of self-reflection.',
    position: 'bottom',
  },
];

// Define the TutorialOverlay component
const TutorialOverlay: React.FC = () => {
  const { 
    currentStep, 
    startTutorial, 
    endTutorial, 
    markStepAsComplete, 
    isTutorialActive,
    isStepComplete,
    resetTutorial,
  } = useTutorial();
  
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showRestartConfirmation, setShowRestartConfirmation] = useState(false);
  const [showRestartError, setShowRestartError] = useState(false);
  const [restartErrorMessage, setRestartErrorMessage] = useState('');
  
  const [isClosing, setIsClosing] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  
  const isMobile = useIsMobile();
  const { width } = useWindowSize();
  const { user } = useAuth();
  const { theme } = useTheme();
  
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);
  const [showGoodbyeMessage, setShowGoodbyeMessage] = useState(false);
  
  const [showTooltip, setShowTooltip] = useState(true);
  
  // Fix the highlightedElements ref to be a regular array instead of MutableRefObject
  const [highlightedElements, setHighlightedElements] = useState<HTMLElement[]>([]);
  
  const currentTutorialStep = tutorialSteps[currentStep - 1];
  
  // Determine if we're on the last step
  const isLastStep = currentStep === tutorialSteps.length;
  
  // Determine if we should show the overlay
  const shouldShowOverlay = isTutorialActive && currentTutorialStep;
  
  // Function to handle tutorial completion
  const handleTutorialComplete = () => {
    if (isLastStep) {
      setShowConfirmation(true);
      // End the tutorial after a delay to allow the confirmation to be seen
      setTimeout(() => {
        setShowConfirmation(false);
        endTutorial();
      }, 2000);
    }
  };
  
  // Function to handle tutorial error
  const handleTutorialError = (message: string) => {
    setErrorMessage(message);
    setShowError(true);
    // End the tutorial after a delay to allow the error to be seen
    setTimeout(() => {
      setShowError(false);
      endTutorial();
    }, 3000);
  };
  
  // Function to handle tutorial restart confirmation
  const handleTutorialRestartConfirmation = () => {
    setShowRestartConfirmation(true);
    // Restart the tutorial after a delay to allow the confirmation to be seen
    setTimeout(() => {
      setShowRestartConfirmation(false);
      resetTutorialHandler();
    }, 2000);
  };
  
  // Function to handle tutorial restart error
  const handleTutorialRestartError = (message: string) => {
    setRestartErrorMessage(message);
    setShowRestartError(true);
    // End the tutorial after a delay to allow the error to be seen
    setTimeout(() => {
      setShowRestartError(false);
    }, 3000);
  };
  
  // Function to handle tutorial restart
  const resetTutorialHandler = async () => {
    setIsRestarting(true);
    try {
      await resetTutorial();
      toast.success('Tutorial restarted successfully!');
    } catch (error: any) {
      console.error('Error resetting tutorial:', error);
      handleTutorialRestartError('Failed to reset tutorial. Please try again.');
    } finally {
      setIsRestarting(false);
    }
  };
  
  // Function to handle tutorial skip
  const skipTutorialHandler = async () => {
    setIsClosing(true);
    try {
      await endTutorial();
      toast.success('Tutorial skipped successfully!');
    } catch (error: any) {
      console.error('Error skipping tutorial:', error);
      handleTutorialError('Failed to skip tutorial. Please try again.');
    } finally {
      setIsClosing(false);
    }
  };
  
  // Function to handle next step
  const handleNextStep = async () => {
    if (!currentTutorialStep) {
      console.warn('No current tutorial step');
      return;
    }
    
    // Mark the current step as complete
    markStepAsComplete(currentStep);
    
    // If it's the last step, complete the tutorial
    if (isLastStep) {
      handleTutorialComplete();
    }
  };
  
  // Function to check if an element is in the viewport
  const isElementInViewport = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  };
  
  // Function to clear any highlighted elements
  const clearHighlightedElements = () => {
    highlightedElements.forEach(element => {
      element.classList.remove('tutorial-highlighted');
      element.classList.remove('tutorial-pulse');
    });
    setHighlightedElements([]);
  };
  
  // Function to focus on an element by selector
  const focusElementBySelector = (selector: string) => {
    // Clear any existing highlights
    clearHighlightedElements();
    
    setTimeout(() => {
      let element = document.querySelector(selector);
      if (!element) {
        console.error(`Element with selector "${selector}" not found`);
        return;
      }
      
      // Position the highlight over the element
      const rect = element.getBoundingClientRect();
      const highlightElement = document.getElementById('tutorial-highlight');
      
      if (highlightElement && rect) {
        // Cast element to HTMLElement to ensure style property exists
        const htmlElement = element as HTMLElement;
        
        highlightElement.style.display = 'block';
        highlightElement.style.top = `${rect.top + window.scrollY}px`;
        highlightElement.style.left = `${rect.left + window.scrollX}px`;
        highlightElement.style.width = `${rect.width}px`;
        highlightElement.style.height = `${rect.height}px`;
        
        // Also add a class to the element itself for additional styling if needed
        htmlElement.classList.add('tutorial-highlighted');
        
        // Add a pulsing animation using a class on the highlighted element
        htmlElement.classList.add('tutorial-pulse');
        
        // If the element is not in view, scroll to it
        if (!isElementInViewport(htmlElement)) {
          htmlElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
        
        // Remember this element for cleanup later
        setHighlightedElements(prevElements => [...prevElements, htmlElement]);
      }
    }, 300);
  };
  
  // Function to hide the highlight
  const hideHighlight = () => {
    const highlightElement = document.getElementById('tutorial-highlight');
    if (highlightElement) {
      highlightElement.style.display = 'none';
    }
    clearHighlightedElements();
  };
  
  // Function to show the highlight
  const showHighlight = () => {
    const highlightElement = document.getElementById('tutorial-highlight');
    if (highlightElement) {
      highlightElement.style.display = 'block';
    }
  };
  
  // Function to update the highlight position
  const updateHighlightPosition = () => {
    if (!currentTutorialStep) {
      console.warn('No current tutorial step');
      return;
    }
    
    focusElementBySelector(currentTutorialStep.selector);
  };
  
  // Function to handle key press events
  const handleKeyPress = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleNextStep();
    }
  };
  
  // Function to handle welcome message timeout
  const handleWelcomeMessageTimeout = () => {
    setShowWelcomeMessage(false);
  };
  
  // Function to handle goodbye message timeout
  const handleGoodbyeMessageTimeout = () => {
    setShowGoodbyeMessage(false);
  };
  
  // Function to handle tooltip timeout
  const handleTooltipTimeout = () => {
    setShowTooltip(false);
  };
  
  // Function to handle start tutorial
  const handleStartTutorial = () => {
    startTutorial();
  };
  
  // Function to handle end tutorial
  const handleEndTutorial = () => {
    endTutorial();
  };
  
  // Function to handle mark step as complete
  const handleMarkStepAsComplete = (step: number) => {
    markStepAsComplete(step);
  };
  
  // Function to handle is step complete
  const handleIsStepComplete = (step: number) => {
    return isStepComplete(step);
  };
  
  // Function to handle reset tutorial
  const handleResetTutorial = () => {
    resetTutorial();
  };
  
  // Use effect to focus on the current step's element
  useEffect(() => {
    if (shouldShowOverlay && currentTutorialStep) {
      focusElementBySelector(currentTutorialStep.selector);
    } else {
      hideHighlight();
    }
    
    // Clean up any highlighted elements when the component unmounts or the step changes
    return () => {
      clearHighlightedElements();
    };
  }, [currentStep, shouldShowOverlay, currentTutorialStep]);
  
  // Use effect to add and remove key press listener
  useEffect(() => {
    if (shouldShowOverlay) {
      window.addEventListener('keydown', handleKeyPress);
    } else {
      window.removeEventListener('keydown', handleKeyPress);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [shouldShowOverlay]);
  
  // Use effect to show and hide welcome message
  useEffect(() => {
    if (showWelcomeMessage) {
      setTimeout(handleWelcomeMessageTimeout, 3000);
    }
  }, [showWelcomeMessage]);
  
  // Use effect to show and hide goodbye message
  useEffect(() => {
    if (showGoodbyeMessage) {
      setTimeout(handleGoodbyeMessageTimeout, 3000);
    }
  }, [showGoodbyeMessage]);
  
  // Use effect to show and hide tooltip
  useEffect(() => {
    if (showTooltip) {
      setTimeout(handleTooltipTimeout, 3000);
    }
  }, [showTooltip]);
  
  // Use effect to update highlight position on window resize
  useEffect(() => {
    window.addEventListener('resize', updateHighlightPosition);
    
    return () => {
      window.removeEventListener('resize', updateHighlightPosition);
    };
  }, []);
  
  // Use effect to start the tutorial when the component mounts
  useEffect(() => {
    if (user && !isTutorialActive) {
      startTutorial();
    }
  }, [user, isTutorialActive, startTutorial]);
  
  return (
    <div>
      {/* This is just a placeholder. Keep existing JSX return content */}
    </div>
  );
};

export default TutorialOverlay;
