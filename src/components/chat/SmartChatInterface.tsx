
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
  const componentRef = useRef<HTMLDivElement>(null);

  // Make component visible on mount
  useEffect(() => {
    console.log("SmartChatInterface mounted");

    if (componentRef.current) {
      // Force visibility
      componentRef.current.style.display = 'flex';
      componentRef.current.style.flexDirection = 'column';
      componentRef.current.style.visibility = 'visible';
      componentRef.current.style.opacity = '1';
      
      console.log("SmartChatInterface visibility forced", componentRef.current);
    }
    
    // Double-check visibility after a delay
    const timer = setTimeout(() => {
      if (componentRef.current) {
        componentRef.current.style.display = 'flex';
        componentRef.current.style.flexDirection = 'column';
        componentRef.current.style.visibility = 'visible';
        componentRef.current.style.opacity = '1';
        console.log("SmartChatInterface delayed visibility check");
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

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
      ref={componentRef}
      className="smart-chat-interface w-full max-w-3xl mx-auto h-[calc(70vh)] md:h-[80vh] flex flex-col"
      style={{ 
        display: 'flex', 
        flexDirection: 'column',
        visibility: 'visible',
        opacity: 1,
        overflow: 'visible'
      }}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-center">Smart Chat {isMobile ? "(Mobile)" : ""}</CardTitle>
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
      
      <CardContent 
        className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4"
        style={{ display: 'block', visibility: 'visible', opacity: 1 }}
      >
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
