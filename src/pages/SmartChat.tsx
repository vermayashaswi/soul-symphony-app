
import { useEffect } from "react";
import SmartChatInterface from "@/components/chat/SmartChatInterface";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { useJournalEntries } from "@/hooks/use-journal-entries";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import SmartChatMobileDebug from "@/components/chat/SmartChatMobileDebug";

export default function SmartChat() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { entries, loading } = useJournalEntries(user?.id, 0, true);
  const navigate = useNavigate();
  
  useEffect(() => {
    document.title = "Smart Chat | SOULo";
    
    // Force proper viewport setup for mobile
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
    
    // Enhanced logging for debugging
    console.log("SmartChat page mounted", {
      isMobile,
      width: window.innerWidth,
      height: window.innerHeight,
      userAgent: navigator.userAgent,
      viewportMeta: metaViewport?.getAttribute('content'),
      auth: !!user
    });
  }, [isMobile, user]);

  const hasEnoughEntries = !loading && entries.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="smart-chat-container container mx-auto py-2 md:py-8 min-h-[calc(100vh-4rem)] flex flex-col"
    >
      <h1 className="text-xl md:text-3xl font-bold text-center mb-2 md:mb-8">Smart Journal Chat</h1>
      
      {!hasEnoughEntries && !loading && (
        <Alert className="mb-3 md:mb-6 border-amber-300 bg-amber-50 text-amber-800">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No journal entries found</AlertTitle>
          <AlertDescription className="mt-2">
            <p>Smart Chat works best when you have journal entries to analyze. Create some journal entries to get personalized insights.</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 border-amber-300 text-amber-800 hover:bg-amber-100"
              onClick={() => navigate('/journal')}
            >
              Go to Journal
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {!isMobile && (
        <p className="text-center text-muted-foreground mb-4 md:mb-8 px-2">
          Ask questions about your journal entries using natural language.
          Get both qualitative insights ("How did I feel about work?") and quantitative analysis 
          ("What are my top 3 emotions?" or "When was I most sad?").
        </p>
      )}
      
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <SmartChatInterface />
      </div>
      
      {/* Show the debug component in development and on mobile */}
      {(process.env.NODE_ENV !== 'production' || isMobile) && <SmartChatMobileDebug />}
    </motion.div>
  );
}
