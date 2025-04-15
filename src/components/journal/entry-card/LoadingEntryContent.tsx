
import React, { useEffect } from 'react';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Loader } from 'lucide-react';
import { useDebugLog } from '@/utils/debug/DebugContext';

export function LoadingEntryContent() {
  const { addEvent } = useDebugLog();
  
  useEffect(() => {
    addEvent('LoadingUI', 'LoadingEntryContent component mounted', 'info');
    
    return () => {
      addEvent('LoadingUI', 'LoadingEntryContent component unmounted', 'info');
    };
  }, [addEvent]);
  
  return (
    <motion.div 
      className="space-y-2"
      initial={{ opacity: 0.8 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      onAnimationStart={() => addEvent('LoadingUI', 'LoadingEntryContent animation started', 'info')}
      onAnimationComplete={() => addEvent('LoadingUI', 'LoadingEntryContent animation completed', 'info')}
    >
      <div className="flex items-center gap-2 mb-4">
        <ShimmerSkeleton className="h-4 w-4 rounded-full" />
        <ShimmerSkeleton className="h-4 w-32" />
      </div>
      
      <ShimmerSkeleton className="h-4 w-full" />
      <ShimmerSkeleton className="h-4 w-3/4" />
      <ShimmerSkeleton className="h-4 w-5/6" />
      <ShimmerSkeleton className="h-4 w-1/2" />
      
      <div className="flex items-center mt-4 justify-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <Loader className="h-3 w-3 animate-spin" />
          Processing with AI...
        </div>
      </div>
    </motion.div>
  );
}
