import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { StreamingMessage } from '@/hooks/useStreamingChat';

interface StreamingStatusDisplayProps {
  isStreaming: boolean;
  currentUserMessage: string;
  showBackendAnimation: boolean;
  streamingMessages: StreamingMessage[];
  dynamicMessages: string[];
  currentMessageIndex: number;
  useThreeDotFallback: boolean;
  queryCategory?: string;
}

const StreamingStatusDisplay: React.FC<StreamingStatusDisplayProps> = ({
  isStreaming,
  currentUserMessage,
  showBackendAnimation,
  streamingMessages,
  dynamicMessages,
  currentMessageIndex,
  useThreeDotFallback,
  queryCategory
}) => {
  if (!isStreaming) return null;

  const getLatestBackendTask = () => {
    const backendTasks = streamingMessages.filter(msg => msg.type === 'backend_task');
    return backendTasks.length > 0 ? backendTasks[backendTasks.length - 1] : null;
  };

  const latestTask = getLatestBackendTask();
  
  // Determine what message to show
  const getDisplayMessage = () => {
    if (useThreeDotFallback || dynamicMessages.length === 0) {
      return null; // Show three-dot animation
    }
    return dynamicMessages[currentMessageIndex] || null;
  };

  const displayMessage = getDisplayMessage();

  // Determine if we should show Loader2 animation based on query category
  const shouldShowLoader2 = () => {
    if (!showBackendAnimation || !latestTask) return false;
    
    // Hide Loader2 for specific query categories
    const categoriesWithoutLoader2 = [
      'GENERAL_MENTAL_HEALTH',
      'JOURNAL_SPECIFIC_NEEDS_CLARIFICATION', 
      'UNRELATED'
    ];
    
    return !queryCategory || !categoriesWithoutLoader2.includes(queryCategory);
  };

  return (
    <div className="flex flex-col space-y-2 p-4 bg-muted/20 rounded-lg border">
      <AnimatePresence mode="wait">
        {!showBackendAnimation && (
          <motion.div
            key={displayMessage || "three-dots"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center space-x-2"
          >
            <div className="flex space-x-1">
              <motion.div
                className="w-2 h-2 bg-primary rounded-full"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <motion.div
                className="w-2 h-2 bg-primary rounded-full"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
              />
              <motion.div
                className="w-2 h-2 bg-primary rounded-full"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
              />
            </div>
            {displayMessage && (
              <motion.span 
                key={displayMessage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-foreground/80"
              >
                {displayMessage}
              </motion.span>
            )}
          </motion.div>
        )}

        {shouldShowLoader2() && (
          <motion.div
            key="backend-task"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center space-x-2"
          >
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <div className="flex flex-col">
              <span className="text-sm text-foreground/60">
                {latestTask.description || latestTask.task}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress indicator */}
      <div className="w-full bg-muted/40 rounded-full h-2">
        <motion.div
          className="bg-primary h-2 rounded-full"
          initial={{ width: "0%" }}
          animate={{ 
            width: shouldShowLoader2() ? "85%" : displayMessage ? "60%" : "30%"
          }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
};

export default StreamingStatusDisplay;