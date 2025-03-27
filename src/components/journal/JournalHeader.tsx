
import React from 'react';
import { motion } from 'framer-motion';

const JournalHeader = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container mx-auto px-4 py-8 max-w-5xl pt-24"
    >
      <h1 className="text-4xl font-bold text-center mb-2">Your Journal</h1>
      <p className="text-center text-muted-foreground mb-8">
        Record your thoughts and track your emotional journey
      </p>
    </motion.div>
  );
};

export default JournalHeader;
