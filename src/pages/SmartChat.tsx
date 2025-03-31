
import { useEffect } from "react";
import SmartChatInterface from "@/components/chat/SmartChatInterface";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

export default function SmartChat() {
  const isMobile = useIsMobile();
  
  useEffect(() => {
    document.title = "Smart Chat | SOULo";
    
    // Force proper viewport setup for mobile
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
    
    // Log for debugging
    console.log("SmartChat page mounted, mobile:", isMobile, "width:", window.innerWidth);
  }, [isMobile]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="smart-chat-container container py-4 md:py-8 mx-auto min-h-[calc(100vh-4rem)] flex flex-col"
    >
      <h1 className="text-2xl md:text-3xl font-bold text-center mb-4 md:mb-8">Smart Journal Chat</h1>
      {!isMobile && (
        <p className="text-center text-muted-foreground mb-6 md:mb-8 px-2">
          Ask questions about your journal entries using natural language.
          Get both qualitative insights ("How did I feel about work?") and quantitative analysis 
          ("What are my top 3 emotions?" or "When was I most sad?").
        </p>
      )}
      
      <div className="flex-1 min-h-0">
        <SmartChatInterface />
      </div>
    </motion.div>
  );
}
