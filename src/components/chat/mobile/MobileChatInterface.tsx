
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, BarChart4, ChevronDown, ChevronUp, Lightbulb, BarChart2, Search, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import MobileChatMessage from "./MobileChatMessage";
import EmptyChatState from "../EmptyChatState";
import MobileChatInput from "./MobileChatInput";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { processChatMessage, ChatMessage as ChatMessageType } from "@/services/chatService";
import { AnimatePresence, motion } from "framer-motion";
import SouloLogo from "@/components/SouloLogo";

export default function MobileChatInterface() {
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessageType[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const demoQuestions = [
    {
      text: "How did I feel yesterday?",
      icon: <BarChart2 className="h-3 w-3 mr-1.5" />
    },
    {
      text: "What makes me happy?",
      icon: <Lightbulb className="h-3 w-3 mr-1.5" />
    },
    {
      text: "Find entries about work",
      icon: <Search className="h-3 w-3 mr-1.5" />
    },
    {
      text: "Analyze my emotions",
      icon: <Brain className="h-3 w-3 mr-1.5" />
    }
  ];

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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
    setShowSuggestions(false);
    
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

  return (
    <Card className="mobile-chat-interface w-full h-full flex flex-col rounded-none shadow-none border-0">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center">
          <SouloLogo useColorTheme={true} className="w-6 h-6 mr-2" />
          <h2 className="text-lg font-semibold">Smart Journal Assistant</h2>
        </div>
        {chatHistory.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="flex items-center gap-1 text-xs"
          >
            <BarChart4 className="h-3 w-3" />
            {showAnalysis ? "Hide" : "Show"}
          </Button>
        )}
      </div>
      
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center max-w-md mx-auto">
              <h1 className="text-2xl font-bold mb-2">How can I help you?</h1>
              <p className="text-muted-foreground mb-6">
                Ask me about your journal entries, feelings, or patterns I notice in your writing.
              </p>
            </div>
          </div>
        ) : (
          <>
            {chatHistory.map((msg, idx) => (
              <MobileChatMessage 
                key={idx} 
                message={msg} 
                showAnalysis={showAnalysis} 
              />
            ))}
          </>
        )}
        
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </CardContent>
      
      <AnimatePresence>
        {showSuggestions && chatHistory.length === 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-4"
          >
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-medium">Try asking</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 w-7 p-0" 
                  onClick={() => setShowSuggestions(false)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {demoQuestions.map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs px-3 py-2 h-auto flex items-center justify-start text-left"
                    onClick={() => handleSendMessage(question.text)}
                  >
                    {question.icon}
                    <span className="truncate">{question.text}</span>
                  </Button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <CardFooter className="p-4 pt-2 border-t">
        <MobileChatInput 
          onSendMessage={handleSendMessage} 
          isLoading={isLoading} 
          userId={user?.id}
        />
      </CardFooter>
    </Card>
  );
}
