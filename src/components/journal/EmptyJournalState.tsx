
import React from 'react';
import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface EmptyJournalStateProps {
  onStartRecording: () => void;
}

const EmptyJournalState: React.FC<EmptyJournalStateProps> = ({ onStartRecording }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="text-center py-8"
    >
      <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 mx-auto">
        <Mic className="h-8 w-8 text-primary" />
      </div>
      
      <h3 className="text-xl font-medium mb-2">
        <TranslatableText text="Welcome to Voice Journaling" />
      </h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        <TranslatableText text="Just speak and we'll do the rest. Your personal AI journaling companion is ready." />
      </p>
      
      <Button 
        onClick={onStartRecording} 
        size="lg" 
        className="gap-2 animate-pulse"
      >
        <Mic className="h-5 w-5" />
        <TranslatableText text="Start Journaling" />
      </Button>
    </motion.div>
  );
};

export default EmptyJournalState;
