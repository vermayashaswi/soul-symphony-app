
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import MobileChatMessage from "./MobileChatMessage";
import MobileChatInput from "./MobileChatInput";
import { processChatMessage, ChatMessage as ChatMessageType } from "@/services/chatService";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";
import ChatThreadList from "@/components/chat/ChatThreadList";

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
  // Always call hooks at the top level consistently
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(propThreadId || null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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
        
        setMessages(formattedMessages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
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
        console.error("Error creating thread:", error);
        toast({
          title: "Error",
          description: "Failed to create new conversation",
          variant: "destructive"
        });
        return;
      }
    }
    
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setLoading(true);
    
    try {
      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          content: message,
          sender: 'user'
        });
        
      if (msgError) throw msgError;
      
      const queryTypes = analyzeQueryTypes(message);
      const response = await processChatMessage(message, user.id, queryTypes);
      
      await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          content: response.content,
          sender: 'assistant',
          reference_entries: response.references || null
        });
      
      if (messages.length === 0) {
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
      
      setMessages(prev => [...prev, response]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: "I'm having trouble processing your request. Please try again later."
        }
      ]);
    } finally {
      setLoading(false);
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
      <div className="flex items-center justify-between py-2 px-4 border-b">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-2">
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
        <div className="w-10"></div> {/* Empty div for balance */}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-full text-center">
            <h3 className="text-xl font-medium mb-2">How can I help you?</h3>
            <p className="text-muted-foreground text-sm mb-4 px-6">
              Ask me anything about your mental well-being and journal entries
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <MobileChatMessage 
              key={index} 
              message={message} 
              showAnalysis={false}
            />
          ))
        )}
        
        {loading && (
          <div className="flex justify-center">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>
      
      <div className="border-t p-2">
        <MobileChatInput 
          onSendMessage={handleSendMessage} 
          isLoading={loading} 
          userId={userId || user?.id}
        />
      </div>
    </div>
  );
}
