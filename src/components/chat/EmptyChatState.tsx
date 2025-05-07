
import React from "react";
import { motion } from "framer-motion";
import { MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TranslatableText } from "@/components/translation/TranslatableText";

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
      
      <h3 className="text-xl font-bold mb-2">
        <TranslatableText text="Start a Conversation" />
      </h3>
      
      <p className="text-muted-foreground max-w-md">
        <TranslatableText text="Ask me anything about your thoughts, feelings, or daily life. I'm here to help!" />
      </p>
      
      <Button 
        variant="outline" 
        size="sm" 
        className="mt-6"
        onClick={() => {
          const newChatButton = document.querySelector('[data-testid="new-chat-button"]') as HTMLButtonElement;
          if (newChatButton) newChatButton.click();
        }}
      >
        <TranslatableText text="New Chat" />
      </Button>
    </motion.div>
  );
};

export default EmptyChatState;
