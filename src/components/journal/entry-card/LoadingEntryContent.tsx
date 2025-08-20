
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
  const componentId = useRef(`loading-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  const stepsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const longProcessingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountTimeRef = useRef<number>(Date.now());
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    console.log('[LoadingEntryContent] Component mounted:', componentId.current);
    
    // Step progression
    const stepInterval = setInterval(() => {
      if (!isVisible) return;
      
      setCurrentStepIndex(prev => (prev + 1) % processingSteps.length);
    }, 1200); // Faster transitions
    
    stepsIntervalRef.current = stepInterval;
    
    // Timeout for "taking too long" message (18 seconds)
    const longProcessingTimeout = setTimeout(() => {
      if (isVisible) {
        console.log('[LoadingEntryContent] Processing taking longer than expected');
        setProcessingTakingTooLong(true);
      }
    }, 18000); // 18 second timeout
    
    longProcessingTimeoutRef.current = longProcessingTimeout;
    
    // Enhanced event listeners with better debugging
    const handleHide = (event: any) => {
      console.log('[LoadingEntryContent] Hide event received:', {
        type: event.type,
        detail: event.detail,
        componentId: componentId.current
      });
      setIsVisible(false);
    };

    const handleProcessingCompleted = (event: any) => {
      console.log('[LoadingEntryContent] Processing completed event received:', {
        type: event.type,
        detail: event.detail,
        componentId: componentId.current
      });
      setIsVisible(false);
    };
    
    // Add multiple event listeners for better coverage
    window.addEventListener('processingEntryHidden', handleHide);
    window.addEventListener('entryContentReady', handleHide);
    window.addEventListener('processingEntryCompleted', handleProcessingCompleted);

    
    return () => {
      console.log('[LoadingEntryContent] Component cleanup:', componentId.current);
      
      if (stepsIntervalRef.current) {
        clearInterval(stepsIntervalRef.current);
      }
      
      if (longProcessingTimeoutRef.current) {
        clearTimeout(longProcessingTimeoutRef.current);
      }

      
      
      window.removeEventListener('processingEntryHidden', handleHide);
      window.removeEventListener('entryContentReady', handleHide);
      window.removeEventListener('processingEntryCompleted', handleProcessingCompleted);
    };
  }, [isVisible]);
  
  if (!isVisible) {
    return null;
  }
  
  const currentStep = processingSteps[currentStepIndex];
  
  return (
    <motion.div 
      className="space-y-2"
      initial={{ opacity: 1 }}
      animate={{ opacity: isVisible ? 1 : 0 }}
      exit={{ 
        opacity: 0,
        transition: { duration: 0.1 }
      }}
      transition={{ duration: 0.1 }}
      data-component-id={componentId.current}
      style={{ 
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.1s ease-out'
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
              animate={{ rotate: 360 }}
              transition={{ 
                rotate: {
                  duration: 2, 
                  repeat: Infinity, 
                  ease: "linear"
                }
              }}
            >
              <Loader2 className="h-10 w-10 text-primary absolute inset-0" />
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentStep.id}
                  initial={{ scale: 0, opacity: 0.7 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0.7 }}
                  transition={{ duration: 0.15 }}
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
                transition={{ duration: 0.15 }}
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
