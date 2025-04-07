
import React from "react";
import { motion } from "framer-motion";
import { MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        <ul className="mt-1 space-y-1">
          <li className="flex items-start">
            <ArrowRight className="h-3 w-3 mr-1 mt-1 flex-shrink-0 text-primary" />
            <span className="text-left">"What were my top emotions last week?"</span>
          </li>
          <li className="flex items-start">
            <ArrowRight className="h-3 w-3 mr-1 mt-1 flex-shrink-0 text-primary" />
            <span className="text-left">"What time of the day do I usually like journaling?"</span>
          </li>
          <li className="flex items-start">
            <ArrowRight className="h-3 w-3 mr-1 mt-1 flex-shrink-0 text-primary" />
            <span className="text-left">"Am i am introvert? Do i like people in general?"</span>
          </li>
          <li className="flex items-start">
            <ArrowRight className="h-3 w-3 mr-1 mt-1 flex-shrink-0 text-primary" />
            <span className="text-left">"What should i particularly do to help my mental health?"</span>
          </li>
          <li className="flex items-start">
            <ArrowRight className="h-3 w-3 mr-1 mt-1 flex-shrink-0 text-primary" />
            <span className="text-left">"Rate my top 3 negative traits out of 100? What do i do to improve them?"</span>
          </li>
        </ul>
      </div>
      
      <Button 
        variant="outline" 
        size="sm" 
        className="mt-6"
        onClick={() => {
          // Trigger a new chat creation
          const newChatButton = document.querySelector('[data-testid="new-chat-button"]') as HTMLButtonElement;
          if (newChatButton) newChatButton.click();
        }}
      >
        Start New Conversation
      </Button>
    </motion.div>
  );
};

export default EmptyChatState;
