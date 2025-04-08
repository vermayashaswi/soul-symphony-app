import React, { useState, useEffect, useRef, useMemo } from "react";
import ChatInput from "./ChatInput";
import ChatMessage from "./ChatMessage";
import { Button } from "@/components/ui/button";
import { processChatMessage } from "@/services/chatService";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import EmptyChatState from "./EmptyChatState";
import ChatArea from "./ChatArea";
import VoiceRecordingButton from "./VoiceRecordingButton";
import { Trash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { ChatMessage as ChatMessageType, getUserChatThreads, getThreadMessages } from "@/services/chatPersistenceService";

type ChatMessageRole = 'user' | 'assistant' | 'error';

export default function SmartChatInterface() {
  const [chatHistory, setChatHistory] = useState<ChatMessageType[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onThreadChange = (event: CustomEvent) => {
      if (event.detail.threadId) {
        setCurrentThreadId(event.detail.threadId);
        loadThreadMessages(event.detail.threadId);
      }
    };
    
    window.addEventListener('threadSelected' as any, onThreadChange);
    
    const storedThreadId = localStorage.getItem("lastActiveChatThreadId");
    if (storedThreadId && user?.id) {
      setCurrentThreadId(storedThreadId);
      loadThreadMessages(storedThreadId);
    } else {
      setInitialLoading(false);
    }
    
    return () => {
      window.removeEventListener('threadSelected' as any, onThreadChange);
    };
  }, [user?.id]);

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
      console.log(`Loading messages for thread ${threadId}`);
      
      const { data: threadData, error: threadError } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('id', threadId)
        .eq('user_id', user.id)
        .single();
        
      if (threadError || !threadData) {
        console.error("Thread not found or doesn't belong to user:", threadError);
        setChatHistory([]);
        setShowSuggestions(true);
        setInitialLoading(false);
        return;
      }
      
      const messages = await getThreadMessages(threadId);
      
      if (messages && messages.length > 0) {
        console.log(`Loaded ${messages.length} messages for thread ${threadId}`);
        setChatHistory(messages);
        setShowSuggestions(false);
      } else {
        console.log(`No messages found for thread ${threadId}`);
        setChatHistory([]);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      toast({
        title: "Error loading messages",
        description: "Could not load conversation history.",
        variant: "destructive"
      });
      setChatHistory([]);
      setShowSuggestions(true);
    } finally {
      setInitialLoading(false);
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
      toast({
        title: "No conversation selected",
        description: "Please select a conversation or start a new one.",
        variant: "destructive"
      });
      return;
    }
    
    setChatHistory(prev => [...prev, { role: 'user', content: message }]);
    setLoading(true);
    setProcessingStage("Analyzing your question...");
    
    try {
      console.log("Performing comprehensive query analysis for:", message);
      setProcessingStage("Analyzing patterns in your journal...");
      const queryTypes = analyzeQueryTypes(message);
      
      const analysisDetails = {
        isEmotionFocused: queryTypes.isEmotionFocused,
        isQuantitative: queryTypes.isQuantitative,
        isWhyQuestion: queryTypes.isWhyQuestion,
        isTemporalQuery: queryTypes.isTemporalQuery,
        timeRange: queryTypes.timeRange.periodName,
        emotion: queryTypes.emotion || 'none detected'
      };
      
      console.log("Query analysis result:", queryTypes);
      
      setProcessingStage("Searching for insights...");
      const response = await processChatMessage(
        message, 
        user.id, 
        queryTypes, 
        threadId,
        false
      );
      
      console.log("Response received:", {
        role: response.role,
        hasReferences: !!response.references?.length,
        refCount: response.references?.length || 0,
        hasAnalysis: !!response.analysis,
        hasNumericResult: response.hasNumericResult,
        errorState: response.role === 'error'
      });
      
      setChatHistory(prev => [
        ...prev, 
        { 
          role: response.role === 'error' ? 'assistant' : response.role as ChatMessageRole,
          content: response.content,
          references: response.references,
          analysis: response.analysis,
          hasNumericResult: response.hasNumericResult
        }
      ]);
    } catch (error: any) {
      console.error("Error sending message:", error);
      
      setChatHistory(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: "I'm having trouble processing your request. Please try again later. " + 
                   (error?.message ? `Error: ${error.message}` : "")
        }
      ]);
    } finally {
      setLoading(false);
      setProcessingStage(null);
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
        
      if (messagesError) {
        console.error("[Desktop] Error deleting messages:", messagesError);
        throw messagesError;
      }
      
      const { error: threadError } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', currentThreadId);
        
      if (threadError) {
        console.error("[Desktop] Error deleting thread:", threadError);
        throw threadError;
      }
      
      setChatHistory([]);
      setShowSuggestions(true);
      
      const { data } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);
        
      if (data && data.length > 0) {
        setCurrentThreadId(data[0].id);
        loadThreadMessages(data[0].id);
        
        window.dispatchEvent(
          new CustomEvent('threadSelected', { 
            detail: { threadId: data[0].id } 
          })
        );
      } else {
        const { data: newThread, error } = await supabase
          .from('chat_threads')
          .insert({
            user_id: user.id,
            title: "New Conversation",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (!error && newThread) {
          setCurrentThreadId(newThread.id);
          
          window.dispatchEvent(
            new CustomEvent('threadSelected', { 
              detail: { threadId: newThread.id } 
            })
          );
        }
      }
      
      toast({
        title: "Success",
        description: "Conversation deleted successfully",
      });
      
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("[Desktop] Error deleting thread:", error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="chat-interface flex flex-col h-full">
      <div className="chat-header flex items-center justify-between py-3 px-4 border-b">
        <h2 className="text-xl font-semibold">Roha</h2>
        
        {currentThreadId && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 text-muted-foreground hover:text-destructive" 
            onClick={() => setShowDeleteDialog(true)}
            title="Delete current conversation"
          >
            <Trash className="h-5 w-5" />
          </Button>
        )}
      </div>
      
      <div className="chat-content flex-1 overflow-hidden">
        {initialLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="ml-2 text-muted-foreground">Loading conversation...</span>
          </div>
        ) : chatHistory.length === 0 ? (
          <EmptyChatState />
        ) : (
          <ChatArea 
            chatMessages={chatHistory}
            isLoading={loading}
            processingStage={processingStage || undefined}
          />
        )}
      </div>
      
      <div className="chat-input-container bg-white border-t p-4">
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
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCurrentThread}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
