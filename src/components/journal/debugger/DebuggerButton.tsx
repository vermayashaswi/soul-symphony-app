
import React from 'react';
import { motion } from 'framer-motion';
import { Code, AlertCircle } from 'lucide-react';

interface DebuggerButtonProps {
  hasErrorState: boolean;
  onClick: () => void;
}

export function DebuggerButton({ hasErrorState, onClick }: DebuggerButtonProps) {
  return (
    <motion.div 
      className={`p-2 rounded-full cursor-pointer shadow-lg hover:opacity-90 transition-colors flex items-center justify-center ${hasErrorState ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'}`}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
    >
      {hasErrorState ? (
        <AlertCircle size={20} />
      ) : (
        <Code size={20} />
      )}
    </motion.div>
  );
}

export default DebuggerButton;
