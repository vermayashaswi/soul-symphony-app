
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface JournalEntriesHeaderProps {
  totalEntries: number;
}

const JournalEntriesHeader: React.FC<JournalEntriesHeaderProps> = ({ totalEntries }) => {
  const navigate = useNavigate();
  
  return (
    <div className="flex justify-between items-center mb-4 journal-entries-header">
      <h2 className="text-xl font-semibold text-foreground">
        <TranslatableText text="Your journal entries" />
        {totalEntries > 0 && (
          <span className="text-muted-foreground text-sm ml-2">
            ({totalEntries})
          </span>
        )}
      </h2>
      
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button 
          onClick={() => navigate('/app/journal/record')}
          className="bg-primary hover:bg-primary/90 text-primary-foreground journal-record-button"
          size="sm"
        >
          <Plus className="mr-1 h-4 w-4" />
          <TranslatableText text="Record Entry" />
        </Button>
      </motion.div>
    </div>
  );
};

export default JournalEntriesHeader;
