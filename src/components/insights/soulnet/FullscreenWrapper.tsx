
import React from 'react';
import { motion } from 'framer-motion';
import { Expand, Minimize } from 'lucide-react';

interface FullscreenWrapperProps {
  children: React.ReactNode;
  isFullScreen: boolean;
  toggleFullScreen: () => void;
}

export const FullscreenWrapper: React.FC<FullscreenWrapperProps> = ({
  children,
  isFullScreen,
  toggleFullScreen
}) => {
  return (
    <motion.div
      className={`
        relative overflow-hidden transition-all duration-300 flex justify-center items-center
        ${isFullScreen 
          ? 'fixed inset-0 z-[9999] m-0 rounded-none border-none bg-transparent' 
          : 'w-full h-[400px] rounded-xl border bg-transparent mx-auto my-4'
        }
      `}
      layout
    >
      {children}
      
      <button
        onClick={toggleFullScreen}
        className="absolute top-4 right-4 z-[10000] p-2 rounded-lg bg-background/80 backdrop-blur-sm shadow-lg"
        aria-label={isFullScreen ? "Minimize" : "Expand to fullscreen"}
      >
        {isFullScreen ? (
          <Minimize className="w-5 h-5 text-foreground" />
        ) : (
          <Expand className="w-5 h-5 text-foreground" />
        )}
      </button>
    </motion.div>
  );
};
