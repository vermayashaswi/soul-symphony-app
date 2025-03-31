
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BarChart4 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ChatMessage from "./ChatMessage";
import EmptyChatState from "./EmptyChatState";
import ChatInput from "./ChatInput";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { processChatMessage, ChatMessage as ChatMessageType } from "@/services/chatService";
import { useIsMobile } from "@/hooks/use-mobile";

export default function SmartChatInterface() {
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessageType[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const cardRef = useRef<HTMLDivElement>(null);

  // Check if we're in mobile preview mode
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  // Add debugging for component lifecycle
  useEffect(() => {
    console.log("SmartChatInterface mounted", {
      isMobile, 
      mobileDemo, 
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      pathname: window.location.pathname
    });
    
    // Force element to be visible after a short delay
    setTimeout(() => {
      if (cardRef.current) {
        console.log("Forcing chat interface visibility");
        cardRef.current.style.display = 'flex';
        cardRef.current.style.opacity = '1';
        cardRef.current.style.visibility = 'visible';
        
        // Log computed styles
        const styles = window.getComputedStyle(cardRef.current);
        console.log("Card styles after force:", {
          display: styles.display,
          visibility: styles.visibility,
          opacity: styles.opacity,
          position: styles.position,
          zIndex: styles.zIndex,
          height: styles.height
        });
      }
    }, 100);
    
    return () => {
      console.log("SmartChatInterface unmounted");
    };
  }, [isMobile, mobileDemo]);

  const handleSendMessage = async (userMessage: string) => {
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please sign in to use the chat feature.",
        variant: "destructive"
      });
      return;
    }
    
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    
    try {
      const queryTypes = analyzeQueryTypes(userMessage);
      const response = await processChatMessage(userMessage, user.id, queryTypes);
      setChatHistory(prev => [...prev, response]);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to get a response. Please try again.",
        variant: "destructive"
      });
      
      setChatHistory(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: "I'm having trouble processing your request. Please try again later."
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAnalysis = () => {
    setShowAnalysis(!showAnalysis);
  };

  return (
    <Card 
      ref={cardRef}
      className={`smart-chat-interface w-full max-w-3xl mx-auto ${isMobile || mobileDemo ? 'h-[calc(75vh)]' : 'h-[80vh]'} flex flex-col overflow-hidden`}
      style={{ 
        display: "flex", 
        visibility: "visible", 
        opacity: 1,
        zIndex: 20
      }}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-center">Smart Chat {isMobile || mobileDemo ? "(Mobile)" : ""}</CardTitle>
        {chatHistory.length > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleAnalysis}
            className="flex items-center gap-1"
          >
            <BarChart4 className="h-4 w-4" />
            {showAnalysis ? "Hide Analysis" : "Show Analysis"}
          </Button>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
        {chatHistory.length === 0 ? (
          <EmptyChatState />
        ) : (
          chatHistory.map((msg, idx) => (
            <ChatMessage key={idx} message={msg} showAnalysis={showAnalysis} />
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </CardContent>
      
      <CardFooter className="border-t p-3 md:p-4">
        <ChatInput 
          onSendMessage={handleSendMessage} 
          isLoading={isLoading} 
          userId={user?.id}
        />
      </CardFooter>
    </Card>
  );
}
