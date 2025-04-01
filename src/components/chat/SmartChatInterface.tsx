
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Loader2, BarChart4, Brain, BarChart2, Search, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { processChatMessage, ChatMessage as ChatMessageType } from "@/services/chatService";
import { motion } from "framer-motion";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Create a type that includes only the roles allowed in the chat UI
type UIChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  references?: any[];
  analysis?: any;
  diagnostics?: any;
  hasNumericResult?: boolean;
  isLoading?: boolean;
}

// Define a type for the chat message from the database
type DbChatMessage = {
  content: string;
  created_at: string;
  id: string;
  reference_entries: any;
  sender: string;
  thread_id: string;
  // Add optional fields that might not be present in all database records
  analysis_data?: any;
  has_numeric_result?: boolean;
}

export default function SmartChatInterface() {
  const [isLoading, setIsLoading] = useState(false);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<UIChatMessage[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

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
      text: "What were my top 3 positive and negative emotions last month?",
      icon: <Brain className="h-4 w-4 mr-2" />
    }
  ];

  useEffect(() => {
    scrollToBottom();
    
    if (currentThreadId) {
      loadThreadMessages(currentThreadId);
    }
  }, [chatHistory, isLoading, currentThreadId]);

  const loadThreadMessages = async (threadId: string) => {
    if (!threadId || !user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        const formattedMessages = data.map((msg: DbChatMessage) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content,
          ...(msg.reference_entries && { references: msg.reference_entries }),
          ...(msg.analysis_data && { analysis: msg.analysis_data }),
          ...(msg.has_numeric_result !== undefined && { hasNumericResult: msg.has_numeric_result })
        })) as UIChatMessage[];
        
        setChatHistory(formattedMessages);
        setShowSuggestions(false);
      } else {
        setChatHistory([]);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  useEffect(() => {
    const onThreadChange = (event: CustomEvent) => {
      if (event.detail.threadId) {
        setCurrentThreadId(event.detail.threadId);
      }
    };
    
    window.addEventListener('threadSelected' as any, onThreadChange);
    
    return () => {
      window.removeEventListener('threadSelected' as any, onThreadChange);
    };
  }, []);

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
    
    let threadId = currentThreadId;
    if (!threadId) {
      try {
        const newThreadId = uuidv4();
        const { error } = await supabase
          .from('chat_threads')
          .insert({
            id: newThreadId,
            user_id: user.id,
            title: "New Conversation",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (error) throw error;
        threadId = newThreadId;
        setCurrentThreadId(newThreadId);
        
        window.dispatchEvent(
          new CustomEvent('newThreadCreated', { 
            detail: { threadId: newThreadId } 
          })
        );
      } catch (error) {
        console.error("Error creating thread:", error);
        toast({
          title: "Error",
          description: "Failed to create new conversation",
          variant: "destructive"
        });
        return;
      }
    }
    
    // Add user message to chat history
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    
    // Add AI thinking message
    setChatHistory(prev => [...prev, { 
      role: 'assistant', 
      content: 'Thinking...',
      isLoading: true 
    }]);
    
    setIsLoading(true);
    setShowSuggestions(false);
    
    // Analyze the query to provide more specific processing stages
    const queryTypes = analyzeQueryTypes(userMessage);
    
    try {
      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          content: userMessage,
          sender: 'user'
        });
        
      if (msgError) throw msgError;
      
      console.log("Desktop: Performing comprehensive query analysis");
      
      // Update the AI thinking message with the current stage
      setChatHistory(prev => {
        const updatedHistory = [...prev];
        const loadingMsgIndex = updatedHistory.findIndex(msg => msg.isLoading);
        if (loadingMsgIndex !== -1) {
          // Start with initial stage
          let stageName = "Analyzing your question...";
          
          // Update stage based on query analysis
          if (queryTypes.isQuantitative && queryTypes.isEmotionFocused) {
            stageName = "Analyzing your emotions and calculating results...";
          } else if (queryTypes.isWhyQuestion) {
            stageName = "Analyzing your question and looking for explanations...";
          } else if (queryTypes.isEmotionFocused) {
            stageName = "Analyzing emotion patterns in your journal...";
          }
          
          updatedHistory[loadingMsgIndex].content = stageName;
          setProcessingStage(stageName);
        }
        return updatedHistory;
      });
      
      console.log("Desktop: Query analysis result:", queryTypes);
      
      // Update stage again based on query progress
      setTimeout(() => {
        setChatHistory(prev => {
          const updatedHistory = [...prev];
          const loadingMsgIndex = updatedHistory.findIndex(msg => msg.isLoading);
          if (loadingMsgIndex !== -1) {
            let nextStage = "Searching for insights...";
            
            if (queryTypes.needsDataAggregation) {
              nextStage = "Aggregating data from your journal entries...";
            } else if (queryTypes.needsVectorSearch) {
              nextStage = "Searching for related entries in your journal...";
            }
            
            updatedHistory[loadingMsgIndex].content = nextStage;
            setProcessingStage(nextStage);
          }
          return updatedHistory;
        });
      }, 1500);
      
      const response = await processChatMessage(userMessage, user.id, queryTypes, threadId);
      console.log("Desktop: Response received with references:", response.references?.length || 0);
      
      // Convert to UI-compatible message and filter out system/error roles
      const uiResponse: UIChatMessage = {
        role: response.role === 'error' ? 'assistant' : response.role as 'user' | 'assistant',
        content: response.content,
        ...(response.references && { references: response.references }),
        ...(response.analysis && { analysis: response.analysis }),
        ...(response.hasNumericResult !== undefined && { hasNumericResult: response.hasNumericResult })
      };
      
      await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          content: response.content,
          sender: 'assistant',
          reference_entries: response.references || null,
          has_numeric_result: response.hasNumericResult || false,
          analysis_data: response.analysis || null
        });
      
      if (chatHistory.length === 0 || (chatHistory.length === 2 && chatHistory[1].isLoading)) {
        const truncatedTitle = userMessage.length > 30 
          ? userMessage.substring(0, 30) + "..." 
          : userMessage;
          
        await supabase
          .from('chat_threads')
          .update({ 
            title: truncatedTitle,
            updated_at: new Date().toISOString()
          })
          .eq('id', threadId);
      }
      
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);
      
      // Remove the loading message and add the actual response
      setChatHistory(prev => {
        const filteredHistory = prev.filter(msg => !msg.isLoading);
        return [...filteredHistory, uiResponse];
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to get a response. Please try again.",
        variant: "destructive"
      });
      
      // Remove the loading message and add an error message
      setChatHistory(prev => {
        const filteredHistory = prev.filter(msg => !msg.isLoading);
        return [
          ...filteredHistory, 
          { 
            role: 'assistant', 
            content: "I'm having trouble processing your request. Please try again later."
          }
        ];
      });
    } finally {
      setIsLoading(false);
      setProcessingStage(null);
    }
  };

  return (
    <Card className="smart-chat-interface w-full h-full flex flex-col shadow-md border rounded-xl overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-center justify-between bg-muted/30 border-b">
        <div className="flex items-center">
          <h2 className="text-xl font-semibold">Roha</h2>
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
          <div className="flex flex-col items-center justify-center h-full w-full">
            <div className="text-center max-w-lg mx-auto px-4">
              <h1 className="text-2xl md:text-3xl font-bold mb-3">How can I help you?</h1>
              <p className="text-muted-foreground mb-6">
                Hey, I am Roha, your personal AI assistant. You can ask me anything about your mental well-being and I will answer your queries basis your own journal insights.
              </p>
              
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto"
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
            {chatHistory.map((msg, idx) => {
              if (msg.isLoading) {
                return (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full flex-shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src="/roha-avatar.png" alt="Roha" />
                        <AvatarFallback className="bg-primary/10">
                          <Loader2 className="h-5 w-5 text-primary animate-spin" />
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="bg-muted/60 border border-border/50 rounded-2xl rounded-tl-none p-4 max-w-[85%] md:max-w-[75%] shadow-sm">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                        <span>{msg.content}</span>
                      </div>
                    </div>
                  </div>
                );
              }
              return <ChatMessage key={idx} message={msg} showAnalysis={showAnalysis} />;
            })}
          </>
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
