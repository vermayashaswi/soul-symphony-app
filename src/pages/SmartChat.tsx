
import { useEffect } from "react";
import SmartChatInterface from "@/components/chat/SmartChatInterface";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

export default function SmartChat() {
  const isMobile = useIsMobile();
  
  useEffect(() => {
    document.title = "Smart Chat | SOULo";
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="container py-4 md:py-8 mx-auto h-[calc(100vh-4rem)]"
    >
      <h1 className="text-2xl md:text-3xl font-bold text-center mb-4 md:mb-8">Smart Journal Chat</h1>
      {!isMobile && (
        <p className="text-center text-muted-foreground mb-6 md:mb-8 px-2">
          Ask questions about your journal entries using natural language.
          Get both qualitative insights and quantitative analysis of your emotions, sentiments, and patterns over time.
        </p>
      )}
      
      <div className="h-[calc(100%-5rem)] md:h-auto">
        <SmartChatInterface />
      </div>
    </motion.div>
  );
}
