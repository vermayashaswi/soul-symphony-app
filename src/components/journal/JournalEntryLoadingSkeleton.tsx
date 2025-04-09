
import React from 'react';
import { LoadingEntryContent } from './entry-card/LoadingEntryContent';
import { ShimmerSkeleton } from '@/components/ui/skeleton';

interface JournalEntryLoadingSkeletonProps {
  count?: number;
}

export default function JournalEntryLoadingSkeleton({ count = 1 }: JournalEntryLoadingSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <ShimmerSkeleton 
          key={`skeleton-${index}`} 
          className="p-4 border border-gray-100 rounded-lg shadow-sm"
        >
          <LoadingEntryContent />
        </ShimmerSkeleton>
      ))}
    </div>
  );
}
