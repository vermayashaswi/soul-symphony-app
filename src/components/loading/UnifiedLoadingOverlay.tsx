import React from 'react';
import { useUnifiedLoading } from '@/hooks/useUnifiedLoading';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingPriority } from '@/services/loadingStateManager';

export const UnifiedLoadingOverlay: React.FC = () => {
  const { isLoading, loadingMessage, loadingPriority } = useUnifiedLoading();

  // Don't show loading for LOW priority items
  if (!isLoading || loadingPriority === LoadingPriority.LOW) {
    return null;
  }

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center"
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground text-center max-w-xs">
              {loadingMessage || 'Loading...'}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};