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
  },
  { 
    id: 'finalizing', 
    text: 'Finalizing your entry...',
    icon: FileText
  }
];

export function LoadingEntryContent({ error }: { error?: string }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [processingTakingTooLong, setProcessingTakingTooLong] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const componentId = useRef(`loading-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  const stepsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const longProcessingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountTimeRef = useRef<number>(Date.now());
  const [isVisible, setIsVisible] = useState(true);
  
  // Enhanced lifecycle management with better transition handling
  useEffect(() => {
    console.log('[LoadingEntryContent] Component mounted:', componentId.current);
    
    // Notify that we're now visible
    window.dispatchEvent(new CustomEvent('loadingContentMounted', {
      detail: { 
        timestamp: Date.now(),
        componentId: componentId.current,
        visible: true
      }
    }));
    
    return () => {
      console.log('[LoadingEntryContent] Component unmounting:', componentId.current);
      window.dispatchEvent(new CustomEvent('loadingContentUnmounted', {
        detail: { 
          timestamp: Date.now(),
          componentId: componentId.current
        }
      }));
    };
  }, []);
  
  // Enhanced step progression with better timing and transition handling
  useEffect(() => {
    const stepInterval = setInterval(() => {
      if (!isVisible || isTransitioning) return;
      
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
      
    }, 1800); // Slightly faster transitions
    
    stepsIntervalRef.current = stepInterval;
    
    // Set a timeout to show a message if processing is taking too long
    const longProcessingTimeout = setTimeout(() => {
      if (isVisible && !isTransitioning) {
        setProcessingTakingTooLong(true);
        
        // Notify that processing is taking a long time
        window.dispatchEvent(new CustomEvent('processingTakingLong', {
          detail: { 
            timestamp: Date.now(),
            componentId: componentId.current
          }
        }));
      }
    }, 15000); // Increased threshold for better UX
    
    longProcessingTimeoutRef.current = longProcessingTimeout;
    
    // Much more conservative content ready handler
    const handleContentReady = (event: CustomEvent) => {
      // Add a delay before starting transition to ensure DOM is ready
      setTimeout(() => {
        console.log('[LoadingEntryContent] Content ready event received, starting transition');
        setIsTransitioning(true);
        
        // Add a longer delay before hiding to ensure smooth transition
        setTimeout(() => {
          setIsVisible(false);
        }, 1000); // Increased from 300ms to 1000ms
      }, 500); // Initial delay to ensure real content is rendered
    };
    
    // Handle transition events with delays
    const handleTransition = (event: CustomEvent) => {
      setTimeout(() => {
        console.log('[LoadingEntryContent] Transition event received');
        setIsTransitioning(true);
      }, 300);
    };
    
    window.addEventListener('entryContentReady', handleContentReady as EventListener);
    window.addEventListener('processingCardTransitioning', handleTransition as EventListener);
    
    return () => {
      if (stepsIntervalRef.current) {
        clearInterval(stepsIntervalRef.current);
      }
      
      if (longProcessingTimeoutRef.current) {
        clearTimeout(longProcessingTimeoutRef.current);
      }
      
      window.removeEventListener('entryContentReady', handleContentReady as EventListener);
      window.removeEventListener('processingCardTransitioning', handleTransition as EventListener);
    };
  }, [currentStepIndex, isVisible, isTransitioning]);
  
  // Don't render if not visible - let React handle removal
  if (!isVisible) {
    return null;
  }
  
  const currentStep = processingSteps[currentStepIndex];
  
  return (
    <motion.div 
      className="space-y-2"
      initial={{ opacity: 0.7 }}
      animate={{ 
        opacity: isTransitioning ? 0.7 : 1, // Keep more visible during transition
        scale: isTransitioning ? 0.99 : 1
      }}
      exit={{ 
        opacity: 0,
        scale: 0.98,
        transition: { duration: 0.5 } // Slower exit animation
      }}
      transition={{ duration: 0.4 }} // Slower transitions
      data-component-id={componentId.current}
      data-transitioning={isTransitioning}
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
                rotate: 360,
                scale: isTransitioning ? 0.95 : 1
              }}
              transition={{ 
                rotate: {
                  duration: 2, 
                  repeat: Infinity, 
                  ease: "linear"
                },
                scale: {
                  duration: 0.4
                }
              }}
            >
              <Loader2 className="h-10 w-10 text-primary absolute inset-0" />
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentStep.id}
                  initial={{ scale: 0, opacity: 0.7 }}
                  animate={{ scale: isTransitioning ? 0.9 : 1, opacity: isTransitioning ? 0.7 : 1 }}
                  exit={{ scale: 0, opacity: 0.7 }}
                  transition={{ duration: 0.4 }} // Slower transitions
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
                animate={{ 
                  y: 0, 
                  opacity: isTransitioning ? 0.7 : 1 
                }}
                exit={{ y: -10, opacity: 0.7 }}
                transition={{ duration: 0.4 }} // Slower transitions
                className="text-sm text-center text-primary font-medium"
              >
                <TranslatableText 
                  text={isTransitioning ? "Finalizing your entry..." : currentStep.text} 
                  forceTranslate={true}
                />
              </motion.div>
            </AnimatePresence>
            
            {processingTakingTooLong && !isTransitioning && (
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
            
            {isTransitioning && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-primary/60 text-center mt-2"
              >
                <TranslatableText 
                  text="Almost ready..." 
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
