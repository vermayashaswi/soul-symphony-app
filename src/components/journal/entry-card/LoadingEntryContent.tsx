
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

export function LoadingEntryContent({ error }: { error?: string }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [processingTakingTooLong, setProcesssingTakingTooLong] = useState(false);
  const mountedRef = useRef(true);
  const componentId = useRef(`loading-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  const stepsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const longProcessingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimersRef = useRef<NodeJS.Timeout[]>([]);
  const unmountingRef = useRef<boolean>(false);
  const forceRemoveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Self cleanup safety - if this component exists for too long (15 seconds), automatically trigger cleanup
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (mountedRef.current && !unmountingRef.current) {
        console.log('[LoadingEntryContent] Safety timeout triggered - component existed for too long');
        unmountingRef.current = true;
        
        // Signal that this component should be removed
        window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
          detail: { 
            componentId: componentId.current,
            timestamp: Date.now(),
            forceCleanup: true,
            reason: 'safety-timeout'
          }
        }));
        
        // Also dispatch a completion event to ensure any associated processing entries are cleaned up
        window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
          detail: { 
            componentId: componentId.current,
            timestamp: Date.now(), 
            forceClearProcessingCard: true,
            reason: 'safety-timeout'
          }
        }));
        
        // Force immediate parent card removal
        removeParentCard();
      }
    }, 15000); // 15 seconds max lifetime (reduced from 20s)
    
    cleanupTimersRef.current.push(safetyTimeout);
    
    return () => {
      clearTimeout(safetyTimeout);
    };
  }, []);
  
  // Function to remove the parent card - called in multiple places for reliability
  const removeParentCard = () => {
    const parentCard = document.querySelector(`[data-component-id="${componentId.current}"]`)?.closest('.journal-entry-card');
    if (parentCard) {
      parentCard.classList.add('force-hidden');
      setTimeout(() => {
        if (parentCard.parentNode) {
          parentCard.parentNode.removeChild(parentCard);
          console.log('[LoadingEntryContent] Parent card removed from DOM');
          
          // Notify that this card has been removed
          window.dispatchEvent(new CustomEvent('processingCardRemoved', {
            detail: { 
              componentId: componentId.current,
              timestamp: Date.now()
            }
          }));
        }
      }, 50);
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
          componentId: componentId.current
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
            componentId: componentId.current
          }
        }));
      }
    }, 10000);
    
    longProcessingTimeoutRef.current = longProcessingTimeout;
    
    // Notify when loading content is mounted
    window.dispatchEvent(new CustomEvent('loadingContentMounted', {
      detail: { 
        timestamp: Date.now(),
        componentId: componentId.current
      }
    }));
    
    // Listen for forces removal events targeted at this component
    const handleForceRemoval = (event: CustomEvent) => {
      const isTargetedRemoval = event.detail?.componentId === componentId.current;
      const isBroadcastRemoval = !event.detail?.componentId && event.detail?.forceCleanup;
      
      if ((isTargetedRemoval || isBroadcastRemoval) && !unmountingRef.current) {
        console.log('[LoadingEntryContent] Forced removal event received for', componentId.current);
        unmountingRef.current = true;
        
        // Signal that we're unmounting
        if (mountedRef.current) {
          window.dispatchEvent(new CustomEvent('loadingContentForceRemoved', {
            detail: { 
              timestamp: Date.now(),
              componentId: componentId.current
            }
          }));
          
          // Force immediate parent card removal
          removeParentCard();
        }
        
        // Clear all our timers
        if (stepsIntervalRef.current) clearInterval(stepsIntervalRef.current);
        if (longProcessingTimeoutRef.current) clearTimeout(longProcessingTimeoutRef.current);
        cleanupTimersRef.current.forEach(timer => clearTimeout(timer));
      }
    };
    
    window.addEventListener('forceRemoveLoadingContent', handleForceRemoval as EventListener);
    window.addEventListener('forceRemoveProcessingCard', handleForceRemoval as EventListener);
    
    // Also listen for content ready events which should remove this component
    const handleContentReady = () => {
      if (!unmountingRef.current) {
        console.log('[LoadingEntryContent] Content ready event received, removing card');
        unmountingRef.current = true;
        
        // Set a timeout to ensure this card is removed even if the animation doesn't complete
        if (forceRemoveTimeoutRef.current) clearTimeout(forceRemoveTimeoutRef.current);
        forceRemoveTimeoutRef.current = setTimeout(() => {
          removeParentCard();
        }, 100);
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
      window.removeEventListener('entryContentReady', handleContentReady as EventListener);
      
      // Notify when loading content is unmounted
      window.dispatchEvent(new CustomEvent('loadingContentUnmounted', {
        detail: { 
          timestamp: Date.now(),
          componentId: componentId.current
        }
      }));
    };
  }, [currentStepIndex]);
  
  const currentStep = processingSteps[currentStepIndex];
  
  // Add CSS to handle forced hiding
  useEffect(() => {
    // Add a style for forced hiding if not already present
    if (!document.getElementById('force-hidden-style')) {
      const style = document.createElement('style');
      style.id = 'force-hidden-style';
      style.textContent = `.force-hidden { display: none !important; opacity: 0 !important; pointer-events: none !important; }`;
      document.head.appendChild(style);
    }
    
    return () => {
      // Cleanup only if no other instances are active
      if (!document.querySelector('.journal-entry-card:not(.force-hidden)')) {
        const style = document.getElementById('force-hidden-style');
        if (style) {
          document.head.removeChild(style);
        }
      }
    };
  }, []);
  
  return (
    <motion.div 
      className="space-y-2"
      initial={{ opacity: 0.7 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0.7 }}
      transition={{ duration: 0.5 }}
      data-component-id={componentId.current}
      onAnimationComplete={() => {
        // Broadcast that this component has finished animating in
        window.dispatchEvent(new CustomEvent('loadingContentAnimated', {
          detail: { 
            componentId: componentId.current,
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
      
      <div className="flex flex-col items-center mt-6 justify-center space-y-2 bg-primary/5 p-3 rounded-lg">
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
                {currentStep.text}
              </motion.div>
            </AnimatePresence>
            
            {processingTakingTooLong && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-muted-foreground text-center mt-2"
              >
                This is taking longer than usual. Please wait a moment...
              </motion.p>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
