
import React from 'react';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

export function LoadingEntryContent() {
  return (
    <motion.div 
      className="space-y-2"
      initial={{ opacity: 0.8 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <ShimmerSkeleton className="h-3 w-full" />
      <ShimmerSkeleton className="h-3 w-3/4" />
      <ShimmerSkeleton className="h-3 w-5/6" />
      <ShimmerSkeleton className="h-3 w-1/2" />
      
      <div className="flex items-center mt-3 justify-center">
        <div className="text-xs text-muted-foreground animate-pulse">
          Processing with AI...
        </div>
      </div>
    </motion.div>
  );
}
