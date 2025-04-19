
import React, { useState, useEffect } from 'react';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  FileText, 
  ThumbsUp, 
  MessagesSquare, 
  Brain, 
  Sparkles,
  HeartHandshake
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

export function LoadingEntryContent() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStepIndex(prev => (prev + 1) % processingSteps.length);
    }, 2500); // Slowed down slightly to make steps more visible
    
    return () => clearInterval(interval);
  }, []);
  
  const currentStep = processingSteps[currentStepIndex];
  
  return (
    <motion.div 
      className="space-y-2"
      initial={{ opacity: 0.7 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0.7 }}
      transition={{ duration: 0.5 }}
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
      </div>
    </motion.div>
  );
}
