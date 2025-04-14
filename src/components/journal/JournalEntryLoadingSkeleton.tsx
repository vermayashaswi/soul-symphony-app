
import React from 'react';
import { LoadingEntryContent } from './entry-card/LoadingEntryContent';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

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
          <div className="p-4 border border-gray-200 dark:border-gray-700 bg-card rounded-lg shadow-sm">
            <LoadingEntryContent />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
