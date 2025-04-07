
import React from "react";
import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";

const EmptyChatState: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center p-6 text-center h-full"
    >
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      
      <h3 className="text-xl font-bold mb-2">AI Assistant</h3>
      
      <p className="text-muted-foreground max-w-md">
        Hey, I am Roha, your personal AI assistant. You can ask me anything about your mental well-being and I will answer your queries basis your own journal insights.
      </p>
      
      <div className="mt-6 text-sm text-muted-foreground/70">
        <p>Try questions like:</p>
        <ul className="mt-1">
          <li>"How did I feel last week?"</li>
          <li>"What makes me happy?"</li>
          <li>"Which entries mention work stress?"</li>
          <li>"Show me my emotional trends"</li>
        </ul>
      </div>
    </motion.div>
  );
};

export default EmptyChatState;
