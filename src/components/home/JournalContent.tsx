
import React from 'react';
import { motion } from 'framer-motion';
import { InspirationalQuote } from '@/components/quotes/InspirationalQuote';
import JournalSummaryCard from '@/components/home/JournalSummaryCard';

const JournalContent: React.FC = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <>
      {/* Journal Summary */}
      <div className="flex-1 px-0 absolute inset-0 z-30 pointer-events-none">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="h-full w-full"
        >
          <motion.div
            variants={itemVariants}
            className="h-full w-full"
          >
            <div className="w-full h-full">
              <JournalSummaryCard />
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Inspirational Quote - Adjusted positioning to remove the gap */}
      <div className="fixed inset-x-0 bottom-20 pb-2 z-25">
        <InspirationalQuote />
      </div>
    </>
  );
};

export default JournalContent;
