import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Loader2 } from "lucide-react";
import MobileChatMessage from "./MobileChatMessage";
import MobileChatInput from "./MobileChatInput";
import { processChatMessage, ChatMessage as ChatMessageType } from "@/services/chatService";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";
import ChatThreadList from "@/components/chat/ChatThreadList";
import { Json } from "@/integrations/supabase/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type UIChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  references?: any[];
  analysis?: any;
  diagnostics?: any;
  hasNumericResult?: boolean;
  isLoading?: boolean;
}

type ChatMessageFromDB = {
  content: string;
  created_at: string;
  id: string;
  reference_entries: any | null;
  analysis_data: any | null;
  has_numeric_result?: boolean;
  sender: string;
  thread_id: string;
}

interface MobileChatInterfaceProps {
  currentThreadId?: string | null;
  onSelectThread?: (threadId: string) => void;
  onCreateNewThread?: () => Promise<void>;
  userId?: string;
}

export default function MobileChatInterface({
  currentThreadId: propThreadId,
  onSelectThread,
  onCreateNewThread,
  userId
}: MobileChatInterfaceProps) {
  const [messages, setMessages] = useState<UIChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(propThreadId || null);
  const { toast } = useToast();
  const { user } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propThreadId) {
      setCurrentThreadId(propThreadId);
      loadThreadMessages(propThreadId);
    }
  }, [propThreadId]);

  useEffect(() => {
    const onThreadChange = (event: CustomEvent) => {
      if (event.detail.threadId) {
        setCurrentThreadId(event.detail.threadId);
        loadThreadMessages(event.detail.threadId);
      }
    };
    
    window.addEventListener('threadSelected' as any, onThreadChange);
    
    return () => {
      window.removeEventListener('threadSelected' as any, onThreadChange);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadThreadMessages = async (threadId: string) => {
    if (!threadId || !user?.id) return;
    
    try {
      console.log(`[Mobile] Loading messages for thread ${threadId}`);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
        
      if (error) {
        console.error(`[Mobile] Error loading messages:`, error);
        throw error;
      }
      
      console.log(`[Mobile] Loaded ${data?.length || 0} messages`);
      
      if (data && data.length > 0) {
        const formattedMessages = data.map((msg: ChatMessageFromDB) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content,
          ...(msg.reference_entries && { references: msg.reference_entries }),
          ...(msg.analysis_data && { analysis: msg.analysis_data }),
          ...(msg.has_numeric_result !== undefined && { hasNumericResult: msg.has_numeric_result })
        })) as UIChatMessage[];
        
        setMessages(formattedMessages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("[Mobile] Error loading messages:", error);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;
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
        if (onCreateNewThread) {
          await onCreateNewThread();
          return; // The event listener will trigger loadThreadMessages
        } else {
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
        }
      } catch (error) {
        console.error("[Mobile] Error creating thread:", error);
        toast({
          title: "Error",
          description: "Failed to create new conversation",
          variant: "destructive"
        });
        return;
      }
    }
    
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: 'Thinking...',
      isLoading: true 
    }]);
    
    setLoading(true);
    setProcessingStage("Analyzing your question...");
    
    try {
      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          content: message,
          sender: 'user'
        });
        
      if (msgError) throw msgError;
      
      console.log("[Mobile] Performing comprehensive query analysis for:", message);
      
      setMessages(prev => {
        const updatedMessages = [...prev];
        const loadingMsgIndex = updatedMessages.findIndex(msg => msg.isLoading);
        if (loadingMsgIndex !== -1) {
          updatedMessages[loadingMsgIndex].content = "Analyzing patterns in your journal...";
        }
        return updatedMessages;
      });
      
      setProcessingStage("Analyzing patterns in your journal...");
      const queryTypes = analyzeQueryTypes(message);
      console.log("[Mobile] Query analysis result:", queryTypes);
      
      setTimeout(() => {
        setMessages(prev => {
          const updatedMessages = [...prev];
          const loadingMsgIndex = updatedMessages.findIndex(msg => msg.isLoading);
          if (loadingMsgIndex !== -1) {
            updatedMessages[loadingMsgIndex].content = "Searching for insights...";
          }
          return updatedMessages;
        });
        setProcessingStage("Searching for insights...");
      }, 1500);
      
      const response = await processChatMessage(message, user.id, queryTypes, threadId);
      console.log("[Mobile] Response received:", {
        role: response.role,
        hasReferences: !!response.references?.length,
        refCount: response.references?.length || 0,
        hasAnalysis: !!response.analysis,
        hasNumericResult: response.hasNumericResult,
        errorState: response.role === 'error'
      });
      
      const uiResponse: UIChatMessage = {
        role: response.role === 'error' ? 'assistant' : response.role as 'user' | 'assistant',
        content: response.content,
        ...(response.references && { references: response.references }),
        ...(response.analysis && { analysis: response.analysis }),
        ...(response.hasNumericResult !== undefined && { hasNumericResult: response.hasNumericResult })
      };
      
      if (response.role === 'error' || response.content.includes("issue retrieving")) {
        console.error("[Mobile] Received error response:", response.content);
      }
      
      const { error: storeError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          content: response.content,
          sender: 'assistant',
          reference_entries: response.references || null,
          has_numeric_result: response.hasNumericResult || false,
          analysis_data: response.analysis || null
        });
        
      if (storeError) {
        console.error("[Mobile] Error storing assistant response:", storeError);
      }
      
      if (messages.length <= 2) {
        const truncatedTitle = message.length > 30 
          ? message.substring(0, 30) + "..." 
          : message;
          
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
      
      setMessages(prev => {
        const filteredMessages = prev.filter(msg => !msg.isLoading);
        return [...filteredMessages, uiResponse];
      });
    } catch (error) {
      console.error("[Mobile] Error sending message:", error);
      setMessages(prev => {
        const filteredMessages = prev.filter(msg => !msg.isLoading);
        return [
          ...filteredMessages, 
          { 
            role: 'assistant', 
            content: "I'm having trouble processing your request. Please try again later."
          }
        ];
      });
    } finally {
      setLoading(false);
      setProcessingStage(null);
    }
  };

  const handleSelectThread = (threadId: string) => {
    setSheetOpen(false);
    if (onSelectThread) {
      onSelectThread(threadId);
    } else {
      setCurrentThreadId(threadId);
      loadThreadMessages(threadId);
    }
  };

  const handleStartNewThread = async () => {
    setSheetOpen(false);
    if (onCreateNewThread) {
      await onCreateNewThread();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mobile-chat-header flex items-center justify-between py-2 px-3">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-1 h-8 w-8">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 sm:max-w-sm w-[85vw]">
            <ChatThreadList 
              userId={userId || user?.id} 
              onSelectThread={handleSelectThread}
              onStartNewThread={handleStartNewThread}
              currentThreadId={currentThreadId}
            />
          </SheetContent>
        </Sheet>
        <h2 className="text-lg font-semibold flex-1 text-center">Roha</h2>
        <div className="w-8"></div>
      </div>
      
      <div className="mobile-chat-content flex-1 overflow-y-auto px-2 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-full text-center px-4 py-6">
            <h3 className="text-xl font-medium mb-2">How can I help you?</h3>
            <p className="text-muted-foreground text-sm mb-4 px-4">
              Ask me anything about your mental well-being and journal entries
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            if (message.isLoading) {
              return (
                <div key={index} className="relative flex items-start gap-2 justify-start">
                  <div className="w-8 h-8 rounded-full flex-shrink-0">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="/lovable-uploads/20d23e7b-7e39-464d-816e-1d4a22b07283.png" alt="Roha" />
                      <AvatarFallback className="bg-primary/10">
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-none p-3.5 text-sm shadow-sm bg-muted/60 border border-border/50">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 text-primary animate-spin" />
                      <span>{message.content}</span>
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <MobileChatMessage 
                key={index} 
                message={message} 
                showAnalysis={false}
              />
            );
          })
        )}
        
        {loading && !messages.some(msg => msg.isLoading) && (
          <div className="flex flex-col items-center justify-center space-y-2 p-4 rounded-lg bg-primary/5">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
            <p className="text-sm text-muted-foreground">{processingStage || "Processing..."}</p>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="mobile-chat-input-container">
        <MobileChatInput 
          onSendMessage={handleSendMessage} 
          isLoading={loading}
          userId={userId || user?.id}
        />
      </div>
    </div>
  );
}
