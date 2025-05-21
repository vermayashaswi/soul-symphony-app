
import React, { useState, useEffect, useRef } from 'react';
import { MobileChatInterfaceProps } from '@/types/chat-interfaces';
import { ChatArea } from '@/components/chat/ChatArea';
import MobileChatInput from './MobileChatInput';
import { useChatPersistence } from '@/services/chat/useChatPersistence';
import { Menu, PlusCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ChatThreadList } from '@/components/chat/ChatThreadList';
import { ChatMessage } from '@/types/chat';
import { useToast } from '@/hooks/use-toast';
import { TranslatableText } from '@/components/translation/TranslatableText';
import EmptyChatState from '@/components/chat/EmptyChatState';
import { supabase } from '@/integrations/supabase/client';

const MobileChatInterface: React.FC<MobileChatInterfaceProps> = ({
  currentThreadId,
  onSelectThread,
  onCreateNewThread,
  userId,
  mentalHealthInsights,
  timezoneOffset,
  timezone
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load messages for the current thread
  useEffect(() => {
    const loadMessages = async () => {
      if (!currentThreadId) {
        setMessages([]);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('thread_id', currentThreadId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (data) {
          const formattedMessages: ChatMessage[] = data.map((msg) => ({
            id: msg.id,
            thread_id: msg.thread_id,
            content: msg.content,
            sender: msg.sender,
            role: msg.sender,
            created_at: msg.created_at,
            reference_entries: msg.reference_entries,
            analysis_data: msg.analysis_data,
            has_numeric_result: msg.has_numeric_result
          }));
          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error("Error loading messages:", error);
        toast({
          title: "Error",
          description: "Could not load chat messages",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [currentThreadId, toast]);

  // Set up real-time subscription to thread messages
  useEffect(() => {
    if (!currentThreadId) return;
    
    const subscription = supabase
      .channel(`thread:${currentThreadId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `thread_id=eq.${currentThreadId}` 
      }, (payload) => {
        const newMessage = payload.new as any;
        const formattedMessage: ChatMessage = {
          id: newMessage.id,
          thread_id: newMessage.thread_id,
          content: newMessage.content,
          sender: newMessage.sender,
          role: newMessage.sender,
          created_at: newMessage.created_at,
          reference_entries: newMessage.reference_entries,
          analysis_data: newMessage.analysis_data,
          has_numeric_result: newMessage.has_numeric_result
        };
        
        setMessages(prev => [...prev, formattedMessage]);
        
        if (newMessage.sender === 'assistant' && isLoading) {
          setIsLoading(false);
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [currentThreadId, isLoading]);

  // Handle sending new message
  const handleSendMessage = async (content: string) => {
    if (!currentThreadId || !userId || !content.trim()) return;
    
    // Create temporary message
    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      thread_id: currentThreadId,
      content,
      sender: 'user',
      role: 'user',
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempMessage]);
    setIsLoading(true);
    setProcessingStage("Processing your request...");
    
    try {
      // Save user message to database
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: currentThreadId,
          content,
          sender: 'user',
          created_at: new Date().toISOString()
        });
        
      if (error) throw error;
      
      // Update thread's last updated timestamp
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentThreadId);
        
      // Processing is now handled by the realtime subscription
      // The processing indicator will be removed when the assistant's response arrives
        
    } catch (error) {
      console.error("Error sending message:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  };

  // Handle creating a new thread
  const handleCreateNewThread = async () => {
    setIsSheetOpen(false);
    const newThreadId = await onCreateNewThread();
    if (newThreadId) {
      setMessages([]);
    }
  };

  // Handle selecting a thread
  const handleSelectThread = (threadId: string) => {
    setIsSheetOpen(false);
    onSelectThread(threadId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header with menu button */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center space-x-2">
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[80vw] sm:max-w-md">
              <SheetHeader className="sheet-header">
                <SheetTitle><TranslatableText text="Conversations" /></SheetTitle>
              </SheetHeader>
              <div className="mt-5">
                <Button 
                  variant="outline" 
                  className="w-full mb-4 justify-start" 
                  onClick={handleCreateNewThread}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  <TranslatableText text="New Conversation" />
                </Button>
                
                <ChatThreadList 
                  activeThreadId={currentThreadId}
                  onSelectThread={handleSelectThread}
                  onCreateThread={handleCreateNewThread}
                  compact={true}
                />
              </div>
            </SheetContent>
          </Sheet>
          <h1 className="text-lg font-semibold">
            <TranslatableText text="Chat" />
          </h1>
        </div>
        
        <Button variant="ghost" size="icon" onClick={handleCreateNewThread}>
          <PlusCircle className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Chat messages area */}
      <div className="flex-1 overflow-hidden" ref={chatContainerRef}>
        {messages.length > 0 ? (
          <ChatArea 
            chatMessages={messages} 
            isLoading={isLoading} 
            processingStage={processingStage}
            threadId={currentThreadId}
          />
        ) : (
          <EmptyChatState onSuggestionClick={handleSendMessage} />
        )}
      </div>
      
      {/* Chat input area */}
      <div className="border-t mobile-chat-input-container">
        <MobileChatInput 
          onSendMessage={handleSendMessage} 
          disabled={isLoading} 
        />
      </div>
    </div>
  );
};

export default MobileChatInterface;
