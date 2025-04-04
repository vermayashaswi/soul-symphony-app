
import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import SouloLogo from '@/components/SouloLogo';
import { cn } from '@/lib/utils';

const JournalHeader = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  const shouldAdjustForMobile = isMobile || mobileDemo;
  
  return (
    <div className={cn(
      "bg-muted/30 py-2 border-b",
      shouldAdjustForMobile ? "mt-0" : "mt-1 md:mt-2"
    )}>
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-1">
          <div className="w-full">
            <motion.h1 
              className="text-4xl sm:text-4xl md:text-5xl font-bold flex items-center gap-2 flex-wrap"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-amber-500 shrink-0" />
              <span className="inline-block">Your <SouloLogo className="inline-flex" useColorTheme={true} /> Journal</span>
            </motion.h1>
            <motion.p 
              className="text-muted-foreground mt-1.5 text-lg sm:text-lg"
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
}

export default JournalHeader;
