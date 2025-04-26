
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
  
  useEffect(() => {
    const stepInterval = setInterval(() => {
      if (!mountedRef.current) return;
      
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
    
    // Set a timeout to show a message if processing is taking too long
    const longProcessingTimeout = setTimeout(() => {
      if (mountedRef.current) {
        setProcessingTakingTooLong(true);
        
        // Notify that processing is taking a long time
        window.dispatchEvent(new CustomEvent('processingTakingLong', {
          detail: { 
            timestamp: Date.now(),
            componentId: componentId.current
          }
        }));
      }
    }, 10000); // Reduced from 15 seconds to 10 seconds
    
    // Notify when loading content is mounted
    window.dispatchEvent(new CustomEvent('loadingContentMounted', {
      detail: { 
        timestamp: Date.now(),
        componentId: componentId.current
      }
    }));
    
    return () => {
      mountedRef.current = false;
      clearInterval(stepInterval);
      clearTimeout(longProcessingTimeout);
      
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
