
import { useEffect } from "react";
import SmartChatInterface from "@/components/chat/SmartChatInterface";
import { motion } from "framer-motion";

export default function SmartChat() {
  useEffect(() => {
    document.title = "Smart Chat | SOULo";
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="container py-8 max-w-7xl mx-auto"
    >
      <h1 className="text-3xl font-bold text-center mb-8">Smart Journal Chat</h1>
      <p className="text-center text-muted-foreground mb-8">
        Ask questions about your journal entries using natural language.
        Our AI will analyze your journals and provide insights by understanding emotions, themes, and entities.
      </p>
      
      <SmartChatInterface />
    </motion.div>
  );
}
