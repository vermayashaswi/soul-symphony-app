
import React, { useState, useEffect, useRef } from 'react';
import { MobileChatInterfaceProps } from '@/types/chat-interfaces';
import ChatInput from "../ChatInput";
import MobileChatMessage from "./MobileChatMessage";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Trash, MessagesSquare } from 'lucide-react';
import EmptyChatState from "@/components/chat/EmptyChatState";
import { useToast } from "@/hooks/use-toast";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { useAuth } from "@/contexts/AuthContext";
import VoiceRecordingButton from "../VoiceRecordingButton";
import { supabase } from '@/integrations/supabase/client';
import { getThreadMessages, saveMessage } from "@/services/chat";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MobileChatInterface: React.FC<MobileChatInterfaceProps> = ({
  currentThreadId,
  onSelectThread,
  onCreateNewThread,
  userId,
  mentalHealthInsights,
  timezoneOffset,
  timezone
}) => {
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const chatBottomRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (currentThreadId && user?.id) {
      loadThreadMessages(currentThreadId);
    } else {
      setInitialLoading(false);
    }
  }, [currentThreadId, user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, loading]);

  const scrollToBottom = () => {
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };
  
  const loadThreadMessages = async (threadId: string) => {
    if (!threadId || !user?.id) {
      setInitialLoading(false);
      return;
    }
    
    setInitialLoading(true);
    
    try {
      const messages = await getThreadMessages(threadId);
      
      if (messages && messages.length > 0) {
        setChatHistory(messages);
      } else {
        setChatHistory([]);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      toast({
        title: "Error loading messages",
        description: "Could not load conversation history.",
        variant: "destructive"
      });
      setChatHistory([]);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !currentThreadId || !user?.id) {
      toast({
        title: "Cannot send message",
        description: "Please check your connection and try again.",
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
    scrollToBottom();
    setLoading(true);

    try {
      // Save the user message
      const savedUserMessage = await saveMessage(currentThreadId, message, 'user');
      
      if (savedUserMessage) {
        setChatHistory(prev => prev.map(msg => 
          msg.id === tempUserMessage.id ? savedUserMessage : msg
        ));
      }
      
      // This would typically be handled by the realtime subscription in a production app
      // For now, we'll simulate the response coming back after a delay
      setTimeout(() => {
        setLoading(false);
      }, 1000);
      
    } catch (error) {
      console.error("Error sending message:", error);
      setLoading(false);
      toast({
        title: "Error sending message",
        description: "Could not send your message. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCurrentThread = async () => {
    if (!currentThreadId || !user?.id) {
      toast({
        title: "Error",
        description: "No active conversation to delete",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('thread_id', currentThreadId);
      
      if (messagesError) throw messagesError;
      
      const { error: threadError } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', currentThreadId);
      
      if (threadError) throw threadError;

      setChatHistory([]);
      setShowDeleteDialog(false);
      
      // Create a new thread
      const newThreadId = await onCreateNewThread();
      if (newThreadId) {
        onSelectThread(newThreadId);
      }

      toast({
        title: "Success",
        description: "Conversation deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting thread:", error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold"><TranslatableText text="Rūḥ" /></h2>
        {currentThreadId && (
          <Button 
            variant="ghost" 
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {initialLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
          </div>
        ) : chatHistory.length === 0 ? (
          <EmptyChatState />
        ) : (
          <>
            {chatHistory.map((message) => (
              <MobileChatMessage
                key={message.id}
                message={message}
                isLoading={false}
              />
            ))}
            {loading && (
              <div className="flex justify-center py-2">
                <div className="animate-pulse flex space-x-2">
                  <div className="h-2 w-2 bg-primary rounded-full"></div>
                  <div className="h-2 w-2 bg-primary rounded-full"></div>
                  <div className="h-2 w-2 bg-primary rounded-full"></div>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </>
        )}
      </div>
      
      <div className="border-t p-4 bg-white">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <ChatInput 
              onSendMessage={handleSendMessage} 
              isLoading={loading} 
              userId={user?.id}
            />
          </div>
          <VoiceRecordingButton 
            isLoading={loading}
            isRecording={false}
            recordingTime={0}
            onStartRecording={() => {}}
            onStopRecording={() => {}}
          />
        </div>
      </div>
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle><TranslatableText text="Delete this conversation?" /></AlertDialogTitle>
            <AlertDialogDescription>
              <TranslatableText text="This will permanently delete this conversation and all its messages. This action cannot be undone." />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel><TranslatableText text="Cancel" /></AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCurrentThread}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              <TranslatableText text="Delete" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MobileChatInterface;
