
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatArea } from './ChatArea';
import { ChatInput } from './ChatInput';
import { EmptyChatState } from './EmptyChatState';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { processChatMessage } from '@/services/chatService';
import { analyzeQuery } from '@/utils/chat/queryAnalyzer';
import { useChatRealtime } from '@/hooks/use-chat-realtime';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { 
  createProcessingMessage, 
  updateProcessingMessage, 
  updateThreadProcessingStatus 
} from '@/utils/chat/threadUtils';

interface SmartChatInterfaceProps {
  mentalHealthInsights?: any;
}

export const SmartChatInterface: React.FC<SmartChatInterfaceProps> = ({ 
  mentalHealthInsights 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isThreadSwitching, setIsThreadSwitching] = useState(false);
  const processingRef = useRef(false);
  
  const { isProcessing, updateProcessingStage } = useChatRealtime(currentThreadId);

  // Load messages for the current thread
  const loadThreadMessages = useCallback(async (threadId: string) => {
    if (!threadId || !user?.id) return;
    
    try {
      setIsThreadSwitching(true);
      console.log(`Loading messages for thread: ${threadId}`);
      
      const { data: threadMessages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading thread messages:', error);
        throw error;
      }

      setMessages(threadMessages || []);
      console.log(`Loaded ${threadMessages?.length || 0} messages for thread ${threadId}`);
    } catch (error) {
      console.error('Failed to load thread messages:', error);
      toast({
        title: "Error",
        description: "Failed to load conversation messages",
        variant: "destructive"
      });
    } finally {
      setIsThreadSwitching(false);
    }
  }, [user?.id, toast]);

  // Handle thread selection events
  useEffect(() => {
    const handleThreadSelected = (event: CustomEvent) => {
      const { threadId } = event.detail;
      console.log('SmartChatInterface: Thread selected event received:', threadId);
      
      if (threadId && threadId !== currentThreadId) {
        setCurrentThreadId(threadId);
        loadThreadMessages(threadId);
      }
    };

    window.addEventListener('threadSelected', handleThreadSelected as EventListener);
    
    return () => {
      window.removeEventListener('threadSelected', handleThreadSelected as EventListener);
    };
  }, [currentThreadId, loadThreadMessages]);

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!currentThreadId) return;

    const subscription = supabase
      .channel(`thread-messages-${currentThreadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${currentThreadId}`
      }, (payload) => {
        const newMessage = payload.new as any;
        if (!newMessage.is_processing) {
          setMessages(prev => {
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [currentThreadId]);

  const handleSendMessage = async (message: string) => {
    if (!user?.id || !currentThreadId || processingRef.current) return;

    try {
      processingRef.current = true;
      setIsLoading(true);
      
      await updateThreadProcessingStatus(currentThreadId, 'processing');
      updateProcessingStage('Analyzing your question...');

      // Save user message immediately
      const { data: userMessage, error: saveError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: currentThreadId,
          content: message,
          sender: 'user',
          role: 'user'
        })
        .select()
        .single();

      if (saveError) throw saveError;

      // Add user message to local state
      setMessages(prev => [...prev, userMessage]);

      // Create processing message
      const processingMessageId = await createProcessingMessage(
        currentThreadId, 
        'Processing your request...'
      );

      if (processingMessageId) {
        updateProcessingStage('Retrieving information...');
      }

      // Analyze query and process
      const queryTypes = analyzeQuery(message);
      const isFollowUp = messages.length > 0;

      const response = await processChatMessage(
        message,
        user.id,
        queryTypes,
        currentThreadId,
        isFollowUp
      );

      // Update processing message with final response
      if (processingMessageId && response) {
        await updateProcessingMessage(
          processingMessageId,
          response.content,
          response.references,
          response.analysis,
          response.hasNumericResult
        );
      }

      await updateThreadProcessingStatus(currentThreadId, 'idle');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
      await updateThreadProcessingStatus(currentThreadId, 'failed');
    } finally {
      processingRef.current = false;
      setIsLoading(false);
      updateProcessingStage(null);
    }
  };

  if (!currentThreadId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (isThreadSwitching) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Switching conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <EmptyChatState 
            onSuggestionClick={handleSendMessage}
            mentalHealthInsights={mentalHealthInsights}
          />
        ) : (
          <ChatArea 
            messages={messages} 
            isLoading={isLoading || isProcessing}
          />
        )}
      </div>
      
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <ChatInput 
          onSendMessage={handleSendMessage}
          disabled={isLoading || isProcessing}
          threadId={currentThreadId}
        />
      </div>
    </div>
  );
};

export default SmartChatInterface;
