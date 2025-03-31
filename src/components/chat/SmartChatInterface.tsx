
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
  const [renderAttempt, setRenderAttempt] = useState(0);
  const [fallbackUIActive, setFallbackUIActive] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const componentRef = useRef<HTMLDivElement>(null);
  
  // Detect when component didn't render correctly
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!componentRef.current || !document.body.contains(componentRef.current)) {
        console.error("SmartChatInterface failed to render properly - activating fallback UI");
        setFallbackUIActive(true);
      }
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, []);

  // Force visibility and make sure component renders
  useEffect(() => {
    console.log("SmartChatInterface mounted (attempt #" + renderAttempt + ")");
    
    // Important: Set critical inline styles directly to ensure visibility
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.getElementById('root')!.style.height = '100%';
    
    if (componentRef.current) {
      // Force styles directly onto the element with !important
      const element = componentRef.current;
      element.style.cssText = `
        display: flex !important;
        flex-direction: column !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: calc(70vh) !important;
        position: relative !important;
        z-index: 1 !important;
      `;
      
      console.log("SmartChatInterface visibility forced via ref", componentRef.current);
    } else {
      console.error("SmartChatInterface ref is null, component may not have rendered");
      
      // Try to re-render the component
      if (renderAttempt < 3) {
        console.log("Attempting to re-render SmartChatInterface");
        const timer = setTimeout(() => {
          setRenderAttempt(prev => prev + 1);
        }, 500);
        return () => clearTimeout(timer);
      } else {
        // After 3 failed attempts, activate fallback UI
        setFallbackUIActive(true);
      }
    }
    
    // Set an observer to ensure the component remains visible
    try {
      const observer = new MutationObserver((mutations) => {
        if (componentRef.current) {
          // If any style changes happen, reapply our styles
          componentRef.current.style.cssText = `
            display: flex !important;
            flex-direction: column !important;
            visibility: visible !important;
            opacity: 1 !important;
            height: calc(70vh) !important;
            position: relative !important;
            z-index: 1 !important;
          `;
        }
      });
      
      if (componentRef.current) {
        observer.observe(componentRef.current, { 
          attributes: true, 
          attributeFilter: ['style', 'class'] 
        });
        
        // Also observe parent containers
        let parent = componentRef.current.parentElement;
        while (parent) {
          observer.observe(parent, { 
            attributes: true, 
            attributeFilter: ['style', 'class'] 
          });
          parent = parent.parentElement;
          if (parent && parent.id === 'root') break;
        }
      }
      
      return () => observer.disconnect();
    } catch (e) {
      console.error("Error setting up observer:", e);
    }
  }, [renderAttempt]);

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

  // Emergency fallback UI for when the normal rendering fails
  if (fallbackUIActive) {
    return (
      <div className="w-full max-w-3xl mx-auto border rounded-lg shadow-lg bg-card p-4 flex flex-col" style={{height: '70vh'}}>
        <div className="flex justify-between items-center border-b pb-3">
          <div className="text-lg font-bold">Smart Chat</div>
          {chatHistory.length > 0 && (
            <Button variant="outline" size="sm" onClick={toggleAnalysis} className="flex items-center gap-1">
              <BarChart4 className="h-4 w-4" />
              {showAnalysis ? "Hide Analysis" : "Show Analysis"}
            </Button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
        </div>
        
        <div className="border-t p-3">
          <ChatInput 
            onSendMessage={handleSendMessage} 
            isLoading={isLoading} 
            userId={user?.id}
          />
        </div>
      </div>
    );
  }

  return (
    <Card 
      ref={componentRef}
      className="smart-chat-interface w-full max-w-3xl mx-auto h-[calc(70vh)] md:h-[80vh] flex flex-col"
      style={{ 
        display: 'flex', 
        flexDirection: 'column',
        visibility: 'visible',
        opacity: 1,
        position: 'relative',
        zIndex: 1
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
