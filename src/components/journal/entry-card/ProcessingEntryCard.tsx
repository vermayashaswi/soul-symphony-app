
import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, Mic } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ShimmerSkeleton } from '@/components/ui/skeleton';

interface ProcessingEntryCardProps {
  tempId: string;
}

export function ProcessingEntryCard({ tempId }: ProcessingEntryCardProps) {
  return (
    <Card className="p-4 bg-card shadow-sm overflow-hidden relative">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Mic className="w-4 h-4 text-primary" />
          </div>
          <div>
            <ShimmerSkeleton className="h-5 w-32 mb-1" />
            <ShimmerSkeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <ShimmerSkeleton className="h-8 w-8 rounded-md" />
          <ShimmerSkeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium text-primary">Processing your entry...</span>
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

        <div className="flex justify-center mt-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="text-xs text-muted-foreground flex items-center gap-1.5"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            Analyzing with AI...
          </motion.div>
        </div>
      </div>
    </Card>
  );
}
