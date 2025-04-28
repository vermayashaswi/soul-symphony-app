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

export function LoadingEntryContent({ error }: { error?: string }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [processingTakingTooLong, setProcessingTakingTooLong] = useState(false);
  const [forceRenderContent, setForceRenderContent] = useState(false);
  const mountedRef = useRef(true);
  const componentId = useRef(`loading-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  const stepsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const longProcessingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimersRef = useRef<NodeJS.Timeout[]>([]);
  const unmountingRef = useRef<boolean>(false);
  
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (mountedRef.current && !unmountingRef.current) {
        console.log('[LoadingEntryContent] Safety timeout triggered - component existed for too long');
        unmountingRef.current = true;
        setForceRenderContent(true);
        
        window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
          detail: { 
            componentId: componentId.current,
            timestamp: Date.now(),
            forceCleanup: true,
            reason: 'safety-timeout'
          }
        }));
        
        window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
          detail: { 
            componentId: componentId.current,
            timestamp: Date.now(), 
            forceClearProcessingCard: true,
            reason: 'safety-timeout'
          }
        }));
        
        window.dispatchEvent(new CustomEvent('entryContentReady', { 
          detail: { 
            timestamp: Date.now(),
            readyForDisplay: true,
            forceRemoveProcessing: true,
            componentId: componentId.current
          }
        }));
      }
    }, 10000);
    
    cleanupTimersRef.current.push(safetyTimeout);
    
    return () => {
      clearTimeout(safetyTimeout);
    };
  }, []);
  
  useEffect(() => {
    const stepInterval = setInterval(() => {
      if (!mountedRef.current || unmountingRef.current) return;
      
      setCurrentStepIndex(prev => (prev + 1) % processingSteps.length);
      
      const currentStep = processingSteps[(currentStepIndex + 1) % processingSteps.length];
      window.dispatchEvent(new CustomEvent('processingStepChanged', {
        detail: { 
          step: currentStep.id, 
          text: currentStep.text,
          componentId: componentId.current
        }
      }));
      
    }, 2000);
    
    stepsIntervalRef.current = stepInterval;
    
    const longProcessingTimeout = setTimeout(() => {
      if (mountedRef.current && !unmountingRef.current) {
        setProcessingTakingTooLong(true);
        
        window.dispatchEvent(new CustomEvent('processingTakingLong', {
          detail: { 
            timestamp: Date.now(),
            componentId: componentId.current
          }
        }));
        
        const fallbackTimeout = setTimeout(() => {
          if (mountedRef.current && !unmountingRef.current) {
            console.log('[LoadingEntryContent] Processing taking too long, forcing content display');
            setForceRenderContent(true);
            
            window.dispatchEvent(new CustomEvent('entryContentReady', { 
              detail: { 
                timestamp: Date.now(),
                readyForDisplay: true,
                forceRemoveProcessing: true,
                componentId: componentId.current,
                reason: 'timeout-fallback'
              }
            }));
          }
        }, 5000);
        
        cleanupTimersRef.current.push(fallbackTimeout);
      }
    }, 8000);
    
    longProcessingTimeoutRef.current = longProcessingTimeout;
    
    window.dispatchEvent(new CustomEvent('loadingContentMounted', {
      detail: { 
        timestamp: Date.now(),
        componentId: componentId.current
      }
    }));
    
    const handleForceRemoval = (event: CustomEvent) => {
      if ((event.detail?.componentId === componentId.current || !event.detail?.componentId) && !unmountingRef.current) {
        console.log('[LoadingEntryContent] Forced removal event received for', componentId.current);
        unmountingRef.current = true;
        
        if (mountedRef.current) {
          window.dispatchEvent(new CustomEvent('loadingContentForceRemoved', {
            detail: { 
              timestamp: Date.now(),
              componentId: componentId.current
            }
          }));
          
          const parentCard = document.querySelector(`[data-component-id="${componentId.current}"]`)?.closest('.journal-entry-card');
          if (parentCard) {
            parentCard.classList.add('force-hidden');
            setTimeout(() => {
              if (parentCard.parentNode) {
                parentCard.parentNode.removeChild(parentCard);
              }
            }, 50);
          }
        }
      }
    };
    
    window.addEventListener('forceRemoveLoadingContent', handleForceRemoval as EventListener);
    window.addEventListener('forceRemoveProcessingCard', handleForceRemoval as EventListener);
    
    const handleContentReady = () => {
      if (!unmountingRef.current) {
        unmountingRef.current = true;
        
        setTimeout(() => {
          const parentCard = document.querySelector(`[data-component-id="${componentId.current}"]`)?.closest('.journal-entry-card');
          if (parentCard) {
            parentCard.classList.add('force-hidden');
            setTimeout(() => {
              if (parentCard.parentNode) {
                parentCard.parentNode.removeChild(parentCard);
              }
            }, 50);
          }
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
      
      cleanupTimersRef.current.forEach(timer => clearTimeout(timer));
      
      window.removeEventListener('forceRemoveLoadingContent', handleForceRemoval as EventListener);
      window.removeEventListener('forceRemoveProcessingCard', handleForceRemoval as EventListener);
      window.removeEventListener('entryContentReady', handleContentReady as EventListener);
      
      window.dispatchEvent(new CustomEvent('loadingContentUnmounted', {
        detail: { 
          timestamp: Date.now(),
          componentId: componentId.current
        }
      }));
    };
  }, [currentStepIndex]);
  
  useEffect(() => {
    if (forceRenderContent && mountedRef.current) {
      unmountingRef.current = true;
      
      window.dispatchEvent(new CustomEvent('entryContentReady', { 
        detail: { 
          timestamp: Date.now(),
          readyForDisplay: true,
          forceRemoveProcessing: true,
          componentId: componentId.current,
          reason: 'manual-force'
        }
      }));
      
      window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
        detail: { 
          componentId: componentId.current,
          timestamp: Date.now(),
          forceCleanup: true,
          reason: 'manual-force'
        }
      }));
    }
  }, [forceRenderContent]);
  
  const currentStep = processingSteps[currentStepIndex];
  
  useEffect(() => {
    if (!document.getElementById('force-hidden-style')) {
      const style = document.createElement('style');
      style.id = 'force-hidden-style';
      style.textContent = `.force-hidden { display: none !important; opacity: 0 !important; pointer-events: none !important; }`;
      document.head.appendChild(style);
    }
    
    return () => {
      if (!document.querySelector('.journal-entry-card:not(.force-hidden)')) {
        const style = document.getElementById('force-hidden-style');
        if (style) {
          document.head.removeChild(style);
        }
      }
    };
  }, []);
  
  if (unmountingRef.current || forceRenderContent) {
    return null;
  }
  
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
            <p className="text-red-500 font-medium text-sm text-center">
              <TranslatableText text={error} />
            </p>
            <p className="text-muted-foreground text-xs text-center mt-2">
              <TranslatableText text="Try refreshing the page or recording again" />
            </p>
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
                <TranslatableText text={currentStep.text} />
              </motion.div>
            </AnimatePresence>
            
            {processingTakingTooLong && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-muted-foreground text-center mt-2"
              >
                <TranslatableText text="This is taking longer than usual. Please wait a moment..." />
              </motion.p>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
