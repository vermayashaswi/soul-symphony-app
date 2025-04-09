
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

export function LoadingEntryContent() {
  // Define animation variants for the loading elements
  const loadingVariants = {
    initial: { opacity: 0.5 },
    animate: { 
      opacity: [0.5, 0.8, 0.5],
      transition: { 
        repeat: Infinity, 
        duration: 1.5,
        ease: "easeInOut" 
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-4">
        <motion.div
          variants={loadingVariants}
          initial="initial"
          animate="animate"
        >
          <Skeleton className="h-4 w-4 rounded-full" />
        </motion.div>
        <motion.div
          variants={loadingVariants}
          initial="initial"
          animate="animate"
        >
          <Skeleton className="h-4 w-32" />
        </motion.div>
      </div>
      
      <motion.div variants={loadingVariants} initial="initial" animate="animate">
        <Skeleton className="h-4 w-full" />
      </motion.div>
      
      <motion.div 
        variants={loadingVariants} 
        initial="initial" 
        animate="animate"
        transition={{ delay: 0.1 }}
      >
        <Skeleton className="h-4 w-3/4" />
      </motion.div>
      
      <motion.div 
        variants={loadingVariants} 
        initial="initial" 
        animate="animate"
        transition={{ delay: 0.2 }}
      >
        <Skeleton className="h-4 w-5/6" />
      </motion.div>
      
      <motion.div 
        variants={loadingVariants} 
        initial="initial" 
        animate="animate"
        transition={{ delay: 0.3 }}
      >
        <Skeleton className="h-4 w-1/2" />
      </motion.div>
    </div>
  );
}
