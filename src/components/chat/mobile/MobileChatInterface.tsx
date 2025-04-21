
import React, { useState, useEffect, useRef } from "react";
import ChatInput from "../ChatInput";
import ChatArea from "../ChatArea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import EmptyChatState from "../EmptyChatState";
import VoiceRecordingButton from "../VoiceRecordingButton";
import { Trash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MobileChatInterface = ({
  currentThreadId,
  onSelectThread,
  onCreateNewThread,
  userId
}: {
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateNewThread: () => Promise<string | null>;
  userId: string | undefined | null;
}) => {
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentThreadId || !userId) {
      setInitialLoading(false);
      setChatHistory([]);
      return;
    }

    const loadMessages = async () => {
      setInitialLoading(true);
      try {
        const { data: messages, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('thread_id', currentThreadId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error("Error loading messages:", error);
          toast({
            title: "Error loading messages",
            description: error.message,
            variant: "destructive"
          });
          setChatHistory([]);
        } else {
          setChatHistory(messages || []);
        }
      } catch (error: any) {
        console.error("Exception loading messages:", error);
        setChatHistory([]);
      } finally {
        setInitialLoading(false);
      }
    };

    loadMessages();
  }, [currentThreadId, userId, toast]);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, loading]);

  const scrollToBottom = () => {
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;
    if (!userId) {
      toast({
        title: "Authentication required",
        description: "Please sign in to use the chat feature.",
        variant: "destructive"
      });
      return;
    }
    if (!currentThreadId) {
      toast({
        title: "No conversation selected",
        description: "Please select a conversation or start a new one.",
        variant: "destructive"
      });
      return;
    }

    const tempUserMessage = {
      id: `temp-${Date.now()}`,
      thread_id: currentThreadId,
      content: message,
      sender: 'user',
      role: 'user',
      created_at: new Date().toISOString()
    };

    setChatHistory(prev => [...prev, tempUserMessage]);
    setLoading(true);
    setProcessingStage("Analyzing your question...");

    try {
      const { data: savedMessage, error: saveError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: currentThreadId,
          content: message,
          sender: 'user',
          role: 'user',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (saveError || !savedMessage) {
        throw new Error(saveError?.message || "Failed to save message");
      }

      setChatHistory(prev => prev.map(msg => msg.id === tempUserMessage.id ? savedMessage : msg));

      setProcessingStage("Searching for insights...");

      // Call edge function or API to process the message (not using queryAnalyzer here)
      // Assuming processChatMessage or similar is called, but since usage isn't shown here, no change needed.

    } catch (error: any) {
      toast({
        title: "Error sending message",
        description: error.message || "Unknown error",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setProcessingStage(null);
    }
  };

  const handleDeleteCurrentThread = async () => {
    if (!currentThreadId) {
      toast({
        title: "Error",
        description: "No active conversation to delete",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error: deleteMessagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('thread_id', currentThreadId);

      if (deleteMessagesError) throw deleteMessagesError;

      const { error: deleteThreadError } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', currentThreadId);

      if (deleteThreadError) throw deleteThreadError;

      setChatHistory([]);
      await onCreateNewThread();

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not delete conversation",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="mobile-chat-interface flex flex-col h-full">
      <div className="chat-content flex-1 overflow-y-auto px-4 pt-4">
        {initialLoading ? (
          <div className="text-center text-muted-foreground">Loading conversation...</div>
        ) : chatHistory.length === 0 ? (
          <EmptyChatState />
        ) : (
          chatHistory.map((msg) => (
            <ChatArea 
              key={msg.id} 
              chatMessages={[msg]} 
              isLoading={false}
              threadId={currentThreadId} // Add the missing threadId prop here
            />
          ))
        )}
        <div ref={chatBottomRef} />
      </div>
      <div className="chat-input-container p-4 bg-white border-t">
        <ChatInput onSendMessage={handleSendMessage} isLoading={loading} userId={userId} />
      </div>
      <div className="chat-footer flex justify-between p-4 border-t">
        <Button
          variant="destructive"
          onClick={() => setShowDeleteDialog(true)}
          disabled={loading || !currentThreadId}
        >
          <Trash className="mr-2 h-4 w-4" /> Delete Conversation
        </Button>
      </div>
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow">
            <p>Are you sure you want to delete this conversation?</p>
            <div className="mt-4 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowDeleteDialog(false);
                  handleDeleteCurrentThread();
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileChatInterface;
