
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface AnimatedPromptProps {
  show: boolean;
}

export function AnimatedPrompt({ show }: AnimatedPromptProps) {
  const componentMountedRef = useRef(true);
  
  // Track component mount state for animation safety
  useEffect(() => {
    componentMountedRef.current = true;
    return () => {
      componentMountedRef.current = false;
    };
  }, []);
  
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="prompt"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="absolute top-6 left-0 right-0 mx-auto text-center px-4 z-10 max-w-md"
          onAnimationComplete={() => {
            // Safety check to prevent errors during unmount
            if (!componentMountedRef.current) return;
          }}
        >
          <h3 className="text-xl font-semibold mb-2">
            <TranslatableText text="Record Your Journal Entry" />
          </h3>
          <p className="text-muted-foreground">
            <TranslatableText text="Press the microphone button to start recording your thoughts." />
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
