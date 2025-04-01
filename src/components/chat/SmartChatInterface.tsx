
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Loader2, BarChart4, Brain, BarChart2, Search, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ChatMessage from "./ChatMessage";
import EmptyChatState from "./EmptyChatState";
import ChatInput from "./ChatInput";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { processChatMessage, ChatMessage as ChatMessageType } from "@/services/chatService";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion } from "framer-motion";
import SouloLogo from "@/components/SouloLogo";

export default function SmartChatInterface() {
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessageType[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const demoQuestions = [
    {
      text: "How did I feel yesterday?",
      icon: <BarChart2 className="h-4 w-4 mr-2" />
    },
    {
      text: "What makes me happy?",
      icon: <Lightbulb className="h-4 w-4 mr-2" />
    },
    {
      text: "Find entries about work",
      icon: <Search className="h-4 w-4 mr-2" />
    },
    {
      text: "Analyze my emotions",
      icon: <Brain className="h-4 w-4 mr-2" />
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
    <Card className="smart-chat-interface w-full h-full flex flex-col shadow-md border rounded-xl overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-center justify-between bg-muted/30 border-b">
        <div className="flex items-center">
          <SouloLogo useColorTheme={true} className="w-7 h-7 mr-2" />
          <h2 className="text-xl font-semibold">AI Assistant</h2>
        </div>
        {chatHistory.length > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="flex items-center gap-1 text-sm"
          >
            <BarChart4 className="h-4 w-4" />
            {showAnalysis ? "Hide Analysis" : "Show Analysis"}
          </Button>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center max-w-lg mx-auto">
              <h1 className="text-3xl font-bold mb-3">How can I help you?</h1>
              <p className="text-muted-foreground mb-6">
                Hey, I am Roha, your personal AI assistant. You can ask me anything about your mental well-being and I will answer your queries basis your own journal insights.
              </p>
              
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="grid grid-cols-2 gap-3 max-w-md mx-auto"
                >
                  {demoQuestions.map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="default"
                      className="px-4 py-3 h-auto flex items-center justify-start text-left bg-muted/50 hover:bg-muted"
                      onClick={() => handleSendMessage(question.text)}
                    >
                      {question.icon}
                      <span>{question.text}</span>
                    </Button>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        ) : (
          <>
            {chatHistory.map((msg, idx) => (
              <ChatMessage key={idx} message={msg} showAnalysis={showAnalysis} />
            ))}
          </>
        )}
        
        {isLoading && (
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </CardContent>
      
      <CardFooter className="border-t bg-muted/30 p-4 md:p-6">
        <ChatInput 
          onSendMessage={handleSendMessage} 
          isLoading={isLoading} 
          userId={user?.id}
        />
      </CardFooter>
    </Card>
  );
}
