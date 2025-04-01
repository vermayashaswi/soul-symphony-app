import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, BarChart4, ChevronDown, ChevronUp, Lightbulb, BarChart2, Search, Brain, PanelLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import MobileChatMessage from "./MobileChatMessage";
import MobileChatInput from "./MobileChatInput";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { processChatMessage, ChatMessage as ChatMessageType } from "@/services/chatService";
import { AnimatePresence, motion } from "framer-motion";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";
import ChatThreadList from "@/components/chat/ChatThreadList";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function MobileChatInterface() {
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessageType[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
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
    
    const checkOrCreateThread = async () => {
      if (!user?.id) return;

      try {
        const { data: threads, error } = await supabase
          .from('chat_threads')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (threads && threads.length > 0) {
          setCurrentThreadId(threads[0].id);
          loadThreadMessages(threads[0].id);
        } else {
          await createNewThread();
        }
      } catch (error) {
        console.error("Error checking threads:", error);
      }
    };

    checkOrCreateThread();
  }, [user?.id]);

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
      toast({
        title: "Error",
        description: "Failed to load chat history",
        variant: "destructive"
      });
    }
  };

  const createNewThread = async () => {
    if (!user?.id) return;
    
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
      setCurrentThreadId(newThreadId);
      setChatHistory([]);
      return newThreadId;
    } catch (error) {
      console.error("Error creating thread:", error);
      toast({
        title: "Error",
        description: "Failed to create new conversation",
        variant: "destructive"
      });
    }
  };

  const handleSelectThread = (threadId: string) => {
    setCurrentThreadId(threadId);
    loadThreadMessages(threadId);
    setShowSidebar(false);
  };

  const handleStartNewThread = async () => {
    const newThreadId = await createNewThread();
    if (newThreadId) {
      setCurrentThreadId(newThreadId);
      setChatHistory([]);
      setShowSidebar(false);
    }
  };

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
    
    if (!currentThreadId) {
      const newThreadId = await createNewThread();
      if (!newThreadId) return;
    }
    
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setShowSuggestions(false);
    
    try {
      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: currentThreadId,
          content: userMessage,
          sender: 'user'
        });
        
      if (msgError) throw msgError;
      
      const queryTypes = analyzeQueryTypes(userMessage);
      const response = await processChatMessage(userMessage, user.id, queryTypes);
      
      await supabase
        .from('chat_messages')
        .insert({
          thread_id: currentThreadId,
          content: response.content,
          sender: 'assistant',
          reference_entries: response.references || null
        });
      
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
          .eq('id', currentThreadId);
      }
      
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentThreadId);
      
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
          <Sheet open={showSidebar} onOpenChange={setShowSidebar}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2 h-8 w-8">
                <PanelLeft className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[250px] sm:w-[300px] p-0">
              <ChatThreadList
                userId={user?.id}
                onSelectThread={handleSelectThread}
                onStartNewThread={handleStartNewThread}
                currentThreadId={currentThreadId}
              />
            </SheetContent>
          </Sheet>
          <h2 className="text-lg font-semibold">Roha</h2>
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
                Hey, I am Roha, your personal AI assistant. You can ask me anything about your mental well-being and I will answer your queries basis your own journal insights.
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
