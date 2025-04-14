
import React from 'react';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

export function LoadingEntryContent() {
  // Added motion effects for smoother appearance and increased opacity
  return (
    <motion.div 
      className="space-y-2"
      initial={{ opacity: 0.8 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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
    </motion.div>
  );
}
