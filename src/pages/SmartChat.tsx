
import { useEffect, useRef } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Check if we're in mobile preview mode
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  const isDebug = urlParams.get('debug') === 'true';
  
  useEffect(() => {
    document.title = "Smart Chat | SOULo";
    
    // Force proper viewport setup for mobile
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
    
    // Log for debugging
    console.log("SmartChat page mounted", { 
      isMobile, 
      width: window.innerWidth, 
      mobileDemo,
      isDebug,
      containerRef: containerRef.current
    });
    
    // Force visibility after a small delay (works around some mobile browser issues)
    if (containerRef.current) {
      containerRef.current.style.display = 'block';
      containerRef.current.style.visibility = 'visible';
      containerRef.current.style.opacity = '1';
      
      // Additional forced visibility after a delay
      const timer = setTimeout(() => {
        if (containerRef.current) {
          console.log("Forcing visibility on SmartChat container");
          containerRef.current.style.display = 'block';
          containerRef.current.style.visibility = 'visible';
          containerRef.current.style.opacity = '1';
          containerRef.current.style.zIndex = '10';
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isMobile, mobileDemo, isDebug]);

  const hasEnoughEntries = !loading && entries.length > 0;

  // Show debug info conditionally
  const showDebugInfo = isDebug || (process.env.NODE_ENV === 'development');

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="smart-chat-container container py-4 md:py-8 mx-auto min-h-[calc(100vh-4rem)] flex flex-col"
      style={{ display: 'block', visibility: 'visible', opacity: 1 }}
    >
      <h1 className="text-2xl md:text-3xl font-bold text-center mb-4 md:mb-8">
        Smart Journal Chat {isMobile || mobileDemo ? "(Mobile View)" : ""}
      </h1>
      
      {showDebugInfo && (
        <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded-md text-xs">
          <div className="font-semibold">Debug Info:</div>
          <div>isMobile: {isMobile ? 'true' : 'false'}</div>
          <div>Window Width: {window.innerWidth}px</div>
          <div>mobileDemo: {mobileDemo ? 'true' : 'false'}</div>
          <div>User Agent: {navigator.userAgent}</div>
        </div>
      )}
      
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
      
      <div className="flex-1 min-h-0" style={{ display: 'block' }}>
        <SmartChatInterface />
      </div>
    </motion.div>
  );
}
