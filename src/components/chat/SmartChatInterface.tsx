
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
import SouloLogo from "@/components/SouloLogo";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";

export default function SmartChatInterface() {
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessageType[]>([]);
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
      text: "Analyze my emotions",
      icon: <Brain className="h-4 w-4 mr-2" />
    }
  ];

  useEffect(() => {
    scrollToBottom();
    
    // This effect will run when the currentThreadId changes
    if (currentThreadId) {
      loadThreadMessages(currentThreadId);
    }
  }, [chatHistory, isLoading, currentThreadId]);

  // Load messages for a thread
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
        const formattedMessages = data.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content,
          ...(msg.reference_entries && { references: msg.reference_entries })
        })) as ChatMessageType[];
        
        setChatHistory(formattedMessages);
      } else {
        setChatHistory([]);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  // Update current thread ID from parent component
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
    
    // Create or use existing thread
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
        
        // Dispatch event to notify parent component of new thread
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
    
    // Add to UI first for immediate feedback
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setShowSuggestions(false);
    
    try {
      // Save message to database
      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          content: userMessage,
          sender: 'user'
        });
        
      if (msgError) throw msgError;
      
      // Process with AI
      const queryTypes = analyzeQueryTypes(userMessage);
      const response = await processChatMessage(userMessage, user.id, queryTypes);
      
      // Save AI response to database
      await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          content: response.content,
          sender: 'assistant',
          reference_entries: response.references || null
        });
      
      // Update thread title if it's the first message
      if (chatHistory.length === 0) {
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
      
      // Always update thread's last activity timestamp
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);
      
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
