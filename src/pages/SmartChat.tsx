
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

export default function SmartChat() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { entries, loading } = useJournalEntries(user?.id, 0, true);
  const navigate = useNavigate();
  
  // Check if we're in mobile preview mode
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  useEffect(() => {
    document.title = "Smart Chat | SOULo";
    
    // Force proper viewport setup for mobile
    const setCorrectViewport = () => {
      const metaViewport = document.querySelector('meta[name="viewport"]');
      const correctContent = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      
      if (metaViewport) {
        if (metaViewport.getAttribute('content') !== correctContent) {
          console.log("Updating viewport meta tag in SmartChat page");
          metaViewport.setAttribute('content', correctContent);
        }
      } else {
        console.log("Creating new viewport meta tag in SmartChat page");
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = correctContent;
        document.head.appendChild(meta);
      }
    };
    
    // Call immediately and again after a short delay to ensure it takes effect
    setCorrectViewport();
    setTimeout(setCorrectViewport, 100);
    
    // Log for debugging
    console.log("SmartChat page mounted, mobile:", isMobile, "width:", window.innerWidth, "mobileDemo:", mobileDemo);
    
    // Force visibility of container after a delay
    setTimeout(() => {
      const container = document.querySelector('.smart-chat-container');
      if (container) {
        console.log("Smart chat container found, ensuring visibility");
        (container as HTMLElement).style.display = 'flex';
      } else {
        console.log("Smart chat container NOT found after timeout");
      }
    }, 200);
  }, [isMobile, mobileDemo]);

  const hasEnoughEntries = !loading && entries.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="smart-chat-container container py-4 md:py-8 mx-auto min-h-[calc(100vh-4rem)] flex flex-col"
      style={{ display: 'flex' }} // Force display flex to ensure visibility
    >
      <h1 className="text-2xl md:text-3xl font-bold text-center mb-4 md:mb-8">
        Smart Journal Chat {isMobile || mobileDemo ? "(Mobile View)" : ""}
      </h1>
      
      {!hasEnoughEntries && !loading && (
        <Alert className="mb-6 border-amber-300 bg-amber-50 text-amber-800">
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
      
      {!(isMobile || mobileDemo) && (
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
