
import React from 'react';
import { LoadingEntryContent } from './entry-card/LoadingEntryContent';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';

interface JournalEntryLoadingSkeletonProps {
  count?: number;
}

export default function JournalEntryLoadingSkeleton({ count = 1 }: JournalEntryLoadingSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={`skeleton-${index}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          className="overflow-hidden"
        >
          <Card className="p-4 bg-card shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div>
                <ShimmerSkeleton className="h-4 w-28 mb-2" />
                <div className="flex items-center">
                  <ShimmerSkeleton className="h-4 w-4 rounded-full" />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <ShimmerSkeleton className="h-6 w-6 rounded-md" />
                <ShimmerSkeleton className="h-6 w-6 rounded-md" />
              </div>
            </div>
            
            <LoadingEntryContent />
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
