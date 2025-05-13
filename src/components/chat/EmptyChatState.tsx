
import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TranslatableText } from "@/components/translation/TranslatableText";

const EmptyChatState: React.FC = () => {
  // Add sample questions that can be highlighted during tutorial
  const sampleQuestions = [
    "What were my top emotions last week?",
    "How has my sleep quality changed over time?",
    "What topics have I written about most often?",
    "Did I achieve my goals from last month?",
    "Show me patterns in my stress levels"
  ];
  
  useEffect(() => {
    // Add tutorial-specific classnames for highlighting
    const firstQuestion = document.querySelector(".chat-question-suggestion");
    if (firstQuestion) {
      firstQuestion.classList.add("tutorial-chat-question");
    }
  }, []);
  
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
      
      <p className="text-muted-foreground max-w-md mb-6">
        <TranslatableText text="Ask me anything about your thoughts, feelings, or daily life. I'm here to help!" />
      </p>
      
      <div className="w-full max-w-md space-y-3">
        {sampleQuestions.map((question, index) => (
          <div 
            key={index} 
            className={`chat-question-suggestion p-3 bg-primary/10 rounded-lg cursor-pointer hover:bg-primary/20 transition-colors ${index === 0 ? 'tutorial-chat-question' : ''}`}
            onClick={() => {
              const chatInput = document.querySelector('.chat-input textarea') as HTMLTextAreaElement;
              if (chatInput) {
                chatInput.value = question;
                chatInput.focus();
              }
            }}
          >
            <p className="font-medium">{question}</p>
          </div>
        ))}
      </div>
      
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
