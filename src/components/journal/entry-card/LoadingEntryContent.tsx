
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
  const [processingTakingTooLong, setProcessingTakingTooLong] = useState(false);
  const mountedRef = useRef(true);
  const componentId = useRef(`loading-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  const stepsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const longProcessingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimersRef = useRef<NodeJS.Timeout[]>([]);
  const isForciblyRemoved = useRef(false);
  
  // Self cleanup safety - if this component exists for too long (15 seconds), automatically trigger cleanup
  useEffect(() => {
    // Immediately register that this component is mounted
    window.dispatchEvent(new CustomEvent('loadingContentMounted', {
      detail: { 
        timestamp: Date.now(),
        componentId: componentId.current,
        source: 'LoadingEntryContent-mount'
      }
    }));
    
    const safetyTimeout = setTimeout(() => {
      if (mountedRef.current) {
        console.log('[LoadingEntryContent] Safety timeout triggered - component existed for too long');
        isForciblyRemoved.current = true;
        
        // Signal that this component should be removed
        window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
          detail: { 
            componentId: componentId.current,
            timestamp: Date.now(),
            forceCleanup: true,
            reason: 'safety-timeout',
            source: 'LoadingEntryContent-safetyTimeout'
          }
        }));
        
        // Also dispatch a completion event to ensure any associated processing entries are cleaned up
        window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
          detail: { 
            componentId: componentId.current,
            timestamp: Date.now(), 
            forceClearProcessingCard: true,
            reason: 'safety-timeout',
            source: 'LoadingEntryContent-safetyTimeout'
          }
        }));
      }
    }, 15000); // 15 seconds max lifetime (reduced from 30)
    
    cleanupTimersRef.current.push(safetyTimeout);
    
    // Add another aggressive cleanup after 20 seconds as a last resort
    const finalSafetyTimeout = setTimeout(() => {
      if (mountedRef.current) {
        isForciblyRemoved.current = true;
        console.log('[LoadingEntryContent] Final safety timeout triggered');
        
        window.dispatchEvent(new CustomEvent('forceRemoveAllProcessingCards', {
          detail: {
            timestamp: Date.now(),
            source: 'LoadingEntryContent-finalSafetyTimeout'
          }
        }));
        
        // Try to force parent re-render by dispatching a global state change
        window.dispatchEvent(new CustomEvent('processingStateChanged', {
          detail: {
            action: 'forceCleanup',
            timestamp: Date.now(),
            source: 'LoadingEntryContent-finalSafetyTimeout'
          }
        }));
        
        // Force yourself to unmount by setting a special data attribute
        const element = document.querySelector(`[data-component-id="${componentId.current}"]`);
        if (element) {
          element.setAttribute('data-force-remove', 'true');
          element.setAttribute('style', 'display: none !important; opacity: 0 !important; height: 0 !important; overflow: hidden !important;');
        }
      }
    }, 20000);
    
    cleanupTimersRef.current.push(finalSafetyTimeout);
    
    return () => {
      clearTimeout(safetyTimeout);
      clearTimeout(finalSafetyTimeout);
    };
  }, []);
  
  useEffect(() => {
    const stepInterval = setInterval(() => {
      if (!mountedRef.current || isForciblyRemoved.current) return;
      
      setCurrentStepIndex(prev => (prev + 1) % processingSteps.length);
      
      // Notify about the processing step change
      const currentStep = processingSteps[(currentStepIndex + 1) % processingSteps.length];
      window.dispatchEvent(new CustomEvent('processingStepChanged', {
        detail: { 
          step: currentStep.id, 
          text: currentStep.text,
          componentId: componentId.current,
          source: 'LoadingEntryContent-stepChanged'
        }
      }));
      
    }, 2000); // Each step takes 2 seconds
    
    stepsIntervalRef.current = stepInterval;
    
    // Set a timeout to show a message if processing is taking too long
    const longProcessingTimeout = setTimeout(() => {
      if (mountedRef.current && !isForciblyRemoved.current) {
        setProcessingTakingTooLong(true);
        
        // Notify that processing is taking a long time
        window.dispatchEvent(new CustomEvent('processingTakingLong', {
          detail: { 
            timestamp: Date.now(),
            componentId: componentId.current,
            source: 'LoadingEntryContent-processingTakingLong'
          }
        }));
      }
    }, 10000);
    
    longProcessingTimeoutRef.current = longProcessingTimeout;
    
    // Listen for forces removal events targeted at this component
    const handleForceRemoval = (event: CustomEvent) => {
      if ((event.detail?.componentId === componentId.current) || 
          !event.detail?.componentId ||
          event.detail?.forceCleanup === true) {
        
        console.log('[LoadingEntryContent] Forced removal event received for', componentId.current);
        isForciblyRemoved.current = true;
        
        // Signal that we're unmounting
        if (mountedRef.current) {
          window.dispatchEvent(new CustomEvent('loadingContentForceRemoved', {
            detail: { 
              timestamp: Date.now(),
              componentId: componentId.current,
              source: 'LoadingEntryContent-forceRemoved'
            }
          }));
          
          // Try to force parent re-render by dispatching a global state change
          window.dispatchEvent(new CustomEvent('processingStateChanged', {
            detail: {
              action: 'forceCleanup',
              timestamp: Date.now(),
              source: 'LoadingEntryContent-forceRemoved'
            }
          }));
          
          // Force yourself to unmount by setting a special data attribute
          const element = document.querySelector(`[data-component-id="${componentId.current}"]`);
          if (element) {
            element.setAttribute('data-force-remove', 'true');
            element.setAttribute('style', 'display: none !important; opacity: 0 !important; height: 0 !important; overflow: hidden !important;');
          }
        }
      }
    };
    
    window.addEventListener('forceRemoveLoadingContent', handleForceRemoval as EventListener);
    window.addEventListener('forceRemoveProcessingCard', handleForceRemoval as EventListener);
    window.addEventListener('forceRemoveAllProcessingCards', handleForceRemoval as EventListener);
    
    return () => {
      mountedRef.current = false;
      
      if (stepsIntervalRef.current) {
        clearInterval(stepsIntervalRef.current);
      }
      
      if (longProcessingTimeoutRef.current) {
        clearTimeout(longProcessingTimeoutRef.current);
      }
      
      cleanupTimersRef.current.forEach(timer => clearTimeout(timer));
      
      window.removeEventListener('forceRemoveLoadingContent', handleForceRemoval as EventListener);
      window.removeEventListener('forceRemoveProcessingCard', handleForceRemoval as EventListener);
      window.removeEventListener('forceRemoveAllProcessingCards', handleForceRemoval as EventListener);
      
      // Notify when loading content is unmounted
      window.dispatchEvent(new CustomEvent('loadingContentUnmounted', {
        detail: { 
          timestamp: Date.now(),
          componentId: componentId.current,
          source: 'LoadingEntryContent-unmount'
        }
      }));
    };
  }, [currentStepIndex]);
  
  if (isForciblyRemoved.current) {
    return null;
  }
  
  const currentStep = processingSteps[currentStepIndex];
  
  return (
    <motion.div 
      className="space-y-2"
      initial={{ opacity: 0.7 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0.7 }}
      transition={{ duration: 0.5 }}
      data-component-id={componentId.current}
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
