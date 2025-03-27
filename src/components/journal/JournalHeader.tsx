
import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

const JournalHeader = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  return (
    <div className="bg-muted/30 py-8 md:py-12 border-b mt-16 md:mt-20">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <motion.h1 
              className="text-3xl md:text-4xl font-bold flex items-center gap-2"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Sparkles className="h-6 w-6 text-amber-500" />
              Your Journal
            </motion.h1>
            <motion.p 
              className="text-muted-foreground mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Record your thoughts and feelings through voice journaling
            </motion.p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JournalHeader;
