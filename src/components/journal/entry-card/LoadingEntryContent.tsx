
import React, { useState, useEffect, useRef } from 'react';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  FileText, 
  ThumbsUp, 
  MessagesSquare, 
  Brain, 
  Sparkles,
  HeartHandshake,
  AlertTriangle
} from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

const processingSteps = [
  { 
    id: 'transcribing', 
    text: 'Transcribing your entry...',
    icon: MessagesSquare
  },
  { 
    id: 'analyzing', 
    text: 'Analyzing the sentiments...',
    icon: ThumbsUp
  },
  { 
    id: 'understanding', 
    text: 'Understanding your emotions...',
    icon: HeartHandshake
  },
  { 
    id: 'extracting', 
    text: 'Extracting key themes...',
    icon: Brain
  },
  { 
    id: 'generating', 
    text: 'Generating insights...',
    icon: Sparkles
  }
];

export function LoadingEntryContent({ error, tempId }: { error?: string; tempId?: string }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [processingTakingTooLong, setProcesssingTakingTooLong] = useState(false);
  const mountedRef = useRef(true);
  const componentId = useRef(`loading-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  const stepsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const longProcessingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimersRef = useRef<NodeJS.Timeout[]>([]);
  const unmountingRef = useRef<boolean>(false);
  const forceRemoveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef<boolean>(true);
  const mountTimeRef = useRef<number>(Date.now());
  // Added a ref to track if content is ready state
  const contentReadyRef = useRef<boolean>(false);
  const [visibilityState, setVisibilityState] = useState<string>('visible');
  
  // Broadcast that this component was mounted to help track processing entries
  useEffect(() => {
    console.log('[LoadingEntryContent] Component mounted:', componentId.current, 'for tempId:', tempId || 'none');
    
    // Notify that we're now visible
    window.dispatchEvent(new CustomEvent('loadingContentMounted', {
      detail: { 
        timestamp: Date.now(),
        componentId: componentId.current,
        tempId: tempId,
        visible: true
      }
    }));
    
    // Add a class to the document to indicate processing is happening
    document.documentElement.classList.add('processing-active');
    
    // Set a minimum visibility time to ensure loading state is visible
    visibilityTimeoutRef.current = setTimeout(() => {
      console.log('[LoadingEntryContent] Minimum visibility time elapsed');
      setVisibilityState('minimum-time-elapsed');
      
      // Dispatch event to notify that we've been visible for at least 2 seconds
      window.dispatchEvent(new CustomEvent('loadingContentMinTimeElapsed', {
        detail: { 
          timestamp: Date.now(),
          componentId: componentId.current,
          tempId: tempId
        }
      }));
    }, 2000); // Ensure loading is visible for at least 2 seconds
    
    return () => {
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
      
      // Only remove the processing class if no other processing components exist
      const otherProcessingElements = document.querySelectorAll('[data-loading-skeleton="true"]');
      if (otherProcessingElements.length <= 1) {
        document.documentElement.classList.remove('processing-active');
      }
      
      console.log('[LoadingEntryContent] Component unmounted:', componentId.current, 'for tempId:', tempId || 'none');
    };
  }, [tempId]);
  
  // Self cleanup safety - if this component exists for too long (15 seconds), automatically trigger cleanup
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (mountedRef.current && !unmountingRef.current) {
        console.log('[LoadingEntryContent] Safety timeout triggered - component existed for too long');
        unmountingRef.current = true;
        setVisibilityState('safety-timeout');
        
        // Signal that this component should be removed
        window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
          detail: { 
            componentId: componentId.current,
            tempId: tempId,
            timestamp: Date.now(),
            forceCleanup: true,
            reason: 'safety-timeout'
          }
        }));
        
        // Also dispatch a completion event to ensure any associated processing entries are cleaned up
        window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
          detail: { 
            componentId: componentId.current,
            tempId: tempId,
            timestamp: Date.now(), 
            forceClearProcessingCard: true,
            reason: 'safety-timeout'
          }
        }));
      }
    }, 15000); // 15 seconds max lifetime
    
    cleanupTimersRef.current.push(safetyTimeout);
    
    return () => {
      clearTimeout(safetyTimeout);
    };
  }, [tempId]);
  
  // Function to safely find and remove the parent card
  const removeParentCard = () => {
    if (!isVisibleRef.current) return; // Skip if already removed
    
    isVisibleRef.current = false;
    setVisibilityState('removing');
    
    try {
      // For forced removals, enforce minimum visibility time
      // For content ready events, don't enforce minimum time
      if (!contentReadyRef.current) {
        // IMPORTANT: Check if we've been visible for at least 2 seconds
        const timeVisible = Date.now() - mountTimeRef.current;
        if (timeVisible < 2000) {
          console.log(`[LoadingEntryContent] Not removing parent card yet, only visible for ${timeVisible}ms`);
          
          // Set a timeout to remove after we've been visible for at least 2 seconds
          const remainingTime = 2000 - timeVisible;
          setTimeout(() => {
            console.log('[LoadingEntryContent] Now removing parent card after enforced minimum visibility');
            safeFindAndRemoveCard();
          }, remainingTime);
          
          return;
        }
      }
      
      safeFindAndRemoveCard();
    } catch (e) {
      console.error('[LoadingEntryContent] Error in removeParentCard:', e);
    }
  };
  
  // Safely find and remove the card from DOM with error handling
  const safeFindAndRemoveCard = () => {
    try {
      // Find the parent card using multiple strategies for reliability
      let parentCard = null;
      
      // Strategy 1: Using component ID attribute
      parentCard = document.querySelector(`[data-component-id="${componentId.current}"]`)?.closest('.journal-entry-card');
      
      // Strategy 2: Using tempId if available
      if (!parentCard && tempId) {
        parentCard = document.querySelector(`[data-temp-id="${tempId}"]`)?.closest('.journal-entry-card');
      }
      
      // Strategy 3: Try to find any processing card if this is a force removal
      if (!parentCard && unmountingRef.current) {
        const allProcessingCards = document.querySelectorAll('.processing-card');
        if (allProcessingCards.length > 0) {
          parentCard = allProcessingCards[0] as HTMLElement;
        }
      }
      
      if (parentCard) {
        // First add transition classes
        parentCard.classList.add('instant-hide-card');
        parentCard.classList.add('processing-card-removing');
        
        // Then actually remove after a short transition
        setTimeout(() => {
          try {
            if (parentCard && parentCard.parentNode) {
              parentCard.parentNode.removeChild(parentCard);
              console.log('[LoadingEntryContent] Parent card removed from DOM');
              
              // Notify that this card has been removed
              window.dispatchEvent(new CustomEvent('processingCardRemoved', {
                detail: { 
                  componentId: componentId.current,
                  tempId: tempId,
                  timestamp: Date.now()
                }
              }));
            }
          } catch (removeError) {
            console.error('[LoadingEntryContent] Error removing parent from DOM:', removeError);
            // Just hide it if we can't remove it
            if (parentCard) {
              parentCard.style.display = 'none';
              parentCard.style.visibility = 'hidden';
              parentCard.style.position = 'absolute';
              parentCard.style.pointerEvents = 'none';
            }
          }
        }, 300);
      } else {
        console.log('[LoadingEntryContent] Could not find parent card to remove');
      }
    } catch (e) {
      console.error('[LoadingEntryContent] Error in safeFindAndRemoveCard:', e);
    }
  };
  
  useEffect(() => {
    const stepInterval = setInterval(() => {
      if (!mountedRef.current || unmountingRef.current) return;
      
      setCurrentStepIndex(prev => (prev + 1) % processingSteps.length);
      
      // Notify about the processing step change
      const currentStep = processingSteps[(currentStepIndex + 1) % processingSteps.length];
      window.dispatchEvent(new CustomEvent('processingStepChanged', {
        detail: { 
          step: currentStep.id, 
          text: currentStep.text,
          componentId: componentId.current,
          tempId: tempId
        }
      }));
      
    }, 2000); // Each step takes 2 seconds
    
    stepsIntervalRef.current = stepInterval;
    
    // Set a timeout to show a message if processing is taking too long
    const longProcessingTimeout = setTimeout(() => {
      if (mountedRef.current && !unmountingRef.current) {
        setProcesssingTakingTooLong(true);
        
        // Notify that processing is taking a long time
        window.dispatchEvent(new CustomEvent('processingTakingLong', {
          detail: { 
            timestamp: Date.now(),
            componentId: componentId.current,
            tempId: tempId
          }
        }));
      }
    }, 10000);
    
    longProcessingTimeoutRef.current = longProcessingTimeout;
    
    // Listen for forced removal events
    const handleForceRemoval = (event: CustomEvent) => {
      // Check if this is targeted at our component or a broadcast
      const isTargetedRemoval = 
        (event.detail?.componentId === componentId.current) || 
        (event.detail?.tempId === tempId);
      const isBroadcastRemoval = !event.detail?.componentId && !event.detail?.tempId && event.detail?.forceCleanup;
      
      if ((isTargetedRemoval || isBroadcastRemoval) && !unmountingRef.current) {
        console.log('[LoadingEntryContent] Forced removal event received for', componentId.current, 'tempId:', tempId || 'none');
        unmountingRef.current = true;
        setVisibilityState('force-removed');
        
        // Signal that we're unmounting
        if (mountedRef.current) {
          window.dispatchEvent(new CustomEvent('loadingContentForceRemoved', {
            detail: { 
              timestamp: Date.now(),
              componentId: componentId.current,
              tempId
            }
          }));
          
          // IMPORTANT: Only force remove if we've been visible for at least 2 seconds
          const timeVisible = Date.now() - mountTimeRef.current;
          if (timeVisible >= 2000) {
            // Force immediate parent card removal
            removeParentCard();
          } else {
            // Wait for the minimum visibility time
            const remainingTime = 2000 - timeVisible;
            console.log(`[LoadingEntryContent] Delaying removal for ${remainingTime}ms to ensure minimum visibility`);
            
            setTimeout(() => removeParentCard(), remainingTime);
          }
        }
        
        // Clear all our timers
        if (stepsIntervalRef.current) clearInterval(stepsIntervalRef.current);
        if (longProcessingTimeoutRef.current) clearTimeout(longProcessingTimeoutRef.current);
        cleanupTimersRef.current.forEach(timer => clearTimeout(timer));
      }
    };
    
    window.addEventListener('forceRemoveLoadingContent', handleForceRemoval as EventListener);
    window.addEventListener('forceRemoveProcessingCard', handleForceRemoval as EventListener);
    window.addEventListener('forceRemoveAllProcessingCards', handleForceRemoval as EventListener);
    
    // Also listen for content ready events which should remove this component
    const handleContentReady = (event: CustomEvent) => {
      const isTargetedReady = 
        (event.detail?.componentId === componentId.current) || 
        (event.detail?.tempId === tempId);
      
      if (isTargetedReady && !unmountingRef.current) {
        console.log('[LoadingEntryContent] Content ready event received, removing card');
        unmountingRef.current = true;
        contentReadyRef.current = true;  // Mark content as ready
        setVisibilityState('content-ready');
        
        // Set a timeout to ensure this card is removed after animation completes
        if (forceRemoveTimeoutRef.current) clearTimeout(forceRemoveTimeoutRef.current);
        forceRemoveTimeoutRef.current = setTimeout(() => {
          removeParentCard();
        }, 300); // Just wait for the animation duration
      }
    };
    
    window.addEventListener('entryContentReady', handleContentReady as EventListener);
    
    return () => {
      mountedRef.current = false;
      
      if (stepsIntervalRef.current) {
        clearInterval(stepsIntervalRef.current);
      }
      
      if (longProcessingTimeoutRef.current) {
        clearTimeout(longProcessingTimeoutRef.current);
      }
      
      if (forceRemoveTimeoutRef.current) {
        clearTimeout(forceRemoveTimeoutRef.current);
      }
      
      cleanupTimersRef.current.forEach(timer => clearTimeout(timer));
      
      window.removeEventListener('forceRemoveLoadingContent', handleForceRemoval as EventListener);
      window.removeEventListener('forceRemoveProcessingCard', handleForceRemoval as EventListener);
      window.removeEventListener('forceRemoveAllProcessingCards', handleForceRemoval as EventListener);
      window.removeEventListener('entryContentReady', handleContentReady as EventListener);
      
      // Notify when loading content is unmounted
      window.dispatchEvent(new CustomEvent('loadingContentUnmounted', {
        detail: { 
          timestamp: Date.now(),
          componentId: componentId.current,
          tempId: tempId,
          visibilityState
        }
      }));
    };
  }, [currentStepIndex, tempId]);
  
  const currentStep = processingSteps[currentStepIndex];
  
  return (
    <motion.div 
      className="space-y-2"
      initial={{ opacity: 0.7 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0.7 }}
      transition={{ duration: 0.5 }}
      data-component-id={componentId.current}
      data-temp-id={tempId}
      data-visibility-state={visibilityState}
      onAnimationComplete={() => {
        // Broadcast that this component has finished animating in
        window.dispatchEvent(new CustomEvent('loadingContentAnimated', {
          detail: { 
            componentId: componentId.current,
            tempId: tempId,
            timestamp: Date.now()
          }
        }));
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <ShimmerSkeleton className="h-4 w-4 rounded-full" />
        <ShimmerSkeleton className="h-4 w-32" />
      </div>
      
      <ShimmerSkeleton className="h-4 w-full" />
      <ShimmerSkeleton className="h-4 w-3/4" />
      <ShimmerSkeleton className="h-4 w-5/6" />
      <ShimmerSkeleton className="h-4 w-1/2" />
      
      <div className="flex flex-col items-center mt-6 justify-center space-y-2 bg-primary/5 p-3 rounded-lg processing-indicator">
        {error ? (
          <div className="flex flex-col items-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
            <p className="text-red-500 font-medium text-sm text-center">{error}</p>
            <p className="text-muted-foreground text-xs text-center mt-2">Try refreshing the page or recording again</p>
          </div>
        ) : (
          <>
            <motion.div 
              className="relative h-10 w-10"
              animate={{ 
                rotate: 360 
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                ease: "linear" 
              }}
            >
              <Loader2 className="h-10 w-10 text-primary absolute inset-0" />
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentStep.id}
                  initial={{ scale: 0, opacity: 0.7 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0.7 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {React.createElement(currentStep.icon, { 
                    className: "h-5 w-5 text-primary/70" 
                  })}
                </motion.div>
              </AnimatePresence>
            </motion.div>
            
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentStep.id}
                initial={{ y: 10, opacity: 0.7 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0.7 }}
                transition={{ duration: 0.3 }}
                className="text-sm text-center text-primary font-medium"
              >
                <TranslatableText 
                  text={currentStep.text} 
                  forceTranslate={true}
                />
              </motion.div>
            </AnimatePresence>
            
            {processingTakingTooLong && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-muted-foreground text-center mt-2"
              >
                <TranslatableText 
                  text="This is taking longer than usual. Please wait a moment..." 
                  forceTranslate={true}
                />
              </motion.p>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
