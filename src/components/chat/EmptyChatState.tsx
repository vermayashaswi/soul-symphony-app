
import React from "react";
import { motion } from "framer-motion";
import { MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const EmptyChatState: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center p-6 text-center h-full"
    >
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      
      <h3 className="text-xl font-bold mb-2">{t('chat.empty.title')}</h3>
      
      <p className="text-muted-foreground max-w-md">
        {t('chat.empty.description')}
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
        {t('chat.newChat')}
      </Button>
    </motion.div>
  );
};

export default EmptyChatState;
