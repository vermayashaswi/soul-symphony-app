
import React from 'react';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export function LoadingEntryContent() {
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
      
      <div className="mt-6 flex flex-wrap gap-2">
        <ShimmerSkeleton className="h-6 w-16 rounded-full" />
        <ShimmerSkeleton className="h-6 w-20 rounded-full" />
        <ShimmerSkeleton className="h-6 w-24 rounded-full" />
      </div>
      
      <div className="flex items-center mt-4 justify-center">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing with AI...
        </div>
      </div>
    </motion.div>
  );
}
