
import React from 'react';
import { motion } from 'framer-motion';
import SouloLogo from '@/components/SouloLogo';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const JournalHeader = () => {
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
        <div className="flex justify-center md:justify-start">
          <motion.h1 
            className="text-2xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Your <SouloLogo className="inline-flex" useColorTheme={true} /> Journal
          </motion.h1>
        </div>
      </div>
    </div>
  );
}

export default JournalHeader;
