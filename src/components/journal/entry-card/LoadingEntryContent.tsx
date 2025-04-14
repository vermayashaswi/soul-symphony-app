
import React from 'react';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

export function LoadingEntryContent() {
  // Use shimmer skeletons for smoother loading appearance
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-4">
        <ShimmerSkeleton className="h-4 w-4 rounded-full" />
        <ShimmerSkeleton className="h-4 w-32" />
      </div>
      
      <ShimmerSkeleton className="h-4 w-full" />
      <ShimmerSkeleton className="h-4 w-3/4" />
      <ShimmerSkeleton className="h-4 w-5/6" />
      <ShimmerSkeleton className="h-4 w-1/2" />
    </div>
  );
}
