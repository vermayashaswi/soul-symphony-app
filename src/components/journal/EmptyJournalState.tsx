
import React from 'react';
import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface EmptyJournalStateProps {
  onStartRecording: () => void;
}

const EmptyJournalState: React.FC<EmptyJournalStateProps> = ({ onStartRecording }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Card>
        <CardContent className="flex flex-col items-center py-12">
          <Mic className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">Your Journal Is Empty</h3>
          <p className="text-muted-foreground text-center mb-6">
            Record your thoughts to begin your journaling experience
          </p>
          <Button onClick={onStartRecording}>
            Record Your First Entry
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default EmptyJournalState;
