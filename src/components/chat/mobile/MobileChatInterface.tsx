import React, { useState, useEffect, useRef, Dispatch, SetStateAction } from "react";
import { useSwipeable } from "react-swipeable";
import { Menu, X, ArrowLeft, Trash2, MessageSquare, Plus } from "lucide-react";
import MobileChatMessage from "./MobileChatMessage";
import MobileChatInput from "./MobileChatInput";
import { processChatMessage } from "@/services/chatService";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";
import EmptyChatState from "../EmptyChatState";
import ChatThreadList from "../ChatThreadList";
import { useDebugLog } from "@/utils/debug/DebugContext";
import { processAndSaveSmartQuery } from "@/services/chat/smartQueryService";
import { ChatMessage } from "@/services/chat";
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

interface MobileChatInterfaceProps {
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateNewThread: () => Promise<string | null>;
  userId: string | undefined;
}

const MobileChatInterface: React.FC<MobileChatInterfaceProps> = ({ 
  currentThreadId, 
  onSelectThread, 
  onCreateNewThread,
  userId
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const loadedThreadRef = useRef<string | null>(null);
  const debugLog = useDebugLog();
  const recordingIntervalRef = useRef<number | null>(null);

  const swipeHandlers = useSwipeable({
    onSwipedRight: () => setIsSidebarOpen(true),
    onSwipedLeft: () => setIsSidebarOpen(false),
    preventDefaultTouchmoveEvent: true,
    trackMouse: false
  });

  useEffect(() => {
    const onThreadChange = (event: CustomEvent) => {
      if (event.detail.threadId) {
        loadThreadMessages(event.detail.threadId);
        debugLog.addEvent("Thread Change", `[Mobile] Thread selected: ${event.detail.threadId}`, "info");
      }
    };
    
    window.addEventListener('threadSelected' as any, onThreadChange);
    
    if (currentThreadId) {
      loadThreadMessages(currentThreadId);
    }
    
    return () => {
      window.removeEventListener('threadSelected' as any, onThreadChange);
    };
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
    
    if (loadedThreadRef.current === threadId) {
      debugLog.addEvent("Thread Loading", `[Mobile] Thread ${threadId} already loaded, skipping`, "info");
      return;
    }
    
    setInitialLoading(true);
    debugLog.addEvent("Thread Loading", `[Mobile] Loading messages for thread ${threadId}`, "info");
    
    try {
      const { data: threadData, error: threadError } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('id', threadId)
        .eq('user_id', user.id)
        .single();
        
      if (threadError || !threadData) {
        debugLog.addEvent("Thread Loading", `[Mobile] Thread not found or doesn't belong to user: ${threadError?.message || "Unknown error"}`, "error");
        console.error("[Mobile] Thread not found or doesn't belong to user:", threadError);
        setChatHistory([]);
        setInitialLoading(false);
        return;
      }
      
      debugLog.addEvent("Thread Loading", `[Mobile] Thread ${threadId} found, fetching messages`, "success");
      const messages = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
        
      if (messages && messages.data && messages.data.length > 0) {
        debugLog.addEvent("Thread Loading", `[Mobile] Loaded ${messages.data.length} messages for thread ${threadId}`, "success");
        console.log(`[Mobile] Loaded ${messages.data.length} messages for thread ${threadId}`);
        setChatHistory(messages.data as ChatMessage[]);
        loadedThreadRef.current = threadId;
      } else {
        debugLog.addEvent("Thread Loading", `[Mobile] No messages found for thread ${threadId}`, "info");
        console.log(`[Mobile] No messages found for thread ${threadId}`);
        setChatHistory([]);
      }
    } catch (error) {
      console.error("[Mobile] Error loading messages:", error);
      debugLog.addEvent("Thread Loading", `[Mobile] Error loading messages: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
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
    if (!message.trim() || !userId || !currentThreadId) return;
    
    const threadId = currentThreadId;
    
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      thread_id: threadId,
      content: message,
      sender: 'user',
      role: 'user',
      created_at: new Date().toISOString()
    };
    
    debugLog.addEvent("User Message", `[Mobile] Adding temporary message to UI: ${tempUserMessage.id}`, "info");
    setChatHistory(prev => [...prev, tempUserMessage]);
    setMessageText("");
    setLoading(true);
    setProcessingStage("Analyzing your question...");
    
    try {
      debugLog.addEvent("Query Analysis", `[Mobile] Analyzing query: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`, "info");
      console.log("[Mobile] Performing comprehensive query analysis for:", message);
      setProcessingStage("Analyzing patterns in your journal...");
      
      debugLog.addEvent("AI Processing", "[Mobile] Sending query to AI for processing", "info");
      const { success, userMessage, assistantMessage, error } = await processAndSaveSmartQuery(
        message, 
        user.id, 
        threadId
      );
      
      if (!success || error) {
        debugLog.addEvent("Smart Query", `[Mobile] Error in smart query processing: ${error}`, "error");
        throw new Error(error || "Failed to process query");
      }
      
      debugLog.addEvent("Smart Query", "[Mobile] Smart query processed successfully", "success");
      console.log("[Mobile] Smart query processed successfully:", { userMessage, assistantMessage });
      
      if (userMessage) {
        debugLog.addEvent("UI Update", `[Mobile] Replacing temporary message with saved message: ${userMessage.id}`, "info");
        setChatHistory(prev => prev.map(msg => 
          msg.id === tempUserMessage.id ? userMessage : msg
        ));
      }
      
      if (assistantMessage) {
        debugLog.addEvent("UI Update", "[Mobile] Adding assistant response to chat history", "info");
        setChatHistory(prev => [...prev, assistantMessage]);
      }
    } catch (error: any) {
      debugLog.addEvent("Error", `[Mobile] Error in message handling: ${error?.message || "Unknown error"}`, "error");
      console.error("[Mobile] Error sending message:", error);
      
      const errorContent = "I'm having trouble processing your request. Please try again later. " + 
               (error?.message ? `Error: ${error.message}` : "");
      
      try {
        debugLog.addEvent("Error Handling", "[Mobile] Saving error message to database", "info");
        const { data: savedErrorMessage, error: saveError } = await supabase
          .from('chat_messages')
          .insert({
            thread_id: threadId,
            content: errorContent,
            sender: 'assistant',
            role: 'assistant'
          })
          .select()
          .single();
        
        if (saveError) {
          throw saveError;
        }
        
        if (savedErrorMessage) {
          debugLog.addEvent("UI Update", "[Mobile] Adding error message to chat history", "warning");
          setChatHistory(prev => [...prev, savedErrorMessage as ChatMessage]);
        } else {
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            thread_id: threadId,
            content: errorContent,
            sender: 'assistant',
            role: 'assistant',
            created_at: new Date().toISOString()
          };
          
          debugLog.addEvent("UI Update", "[Mobile] Adding fallback error message to chat history", "warning");
          setChatHistory(prev => [...prev, errorMessage]);
        }
      } catch (e: any) {
        debugLog.addEvent("Error Handling", `[Mobile] Failed to save error message: ${e instanceof Error ? e.message : "Unknown error"}`, "error");
        console.error("[Mobile] Failed to save error message:", e);
        
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          thread_id: threadId,
          content: errorContent,
          sender: 'assistant',
          role: 'assistant',
          created_at: new Date().toISOString()
        };
        
        debugLog.addEvent("UI Update", "[Mobile] Adding last-resort error message to chat history", "warning");
        setChatHistory(prev => [...prev, errorMessage]);
      }
    } finally {
      setLoading(false);
      setProcessingStage(null);
    }
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    recordingIntervalRef.current = window.setInterval(() => {
      setRecordingTime(prevTime => prevTime + 1);
    }, 1000);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    console.log(`Stopped recording after ${recordingTime} seconds.`);
    toast({
      title: "Voice recording",
      description: `Voice recording of ${recordingTime} seconds processed.`,
    });
    setRecordingTime(0);
  };

  const handleNewChat = async () => {
    setIsSidebarOpen(false);
    const newThreadId = await onCreateNewThread();
    if (newThreadId) {
      loadThreadMessages(newThreadId);
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
        console.error("[Mobile] Error deleting messages:", messagesError);
        throw messagesError;
      }
      
      const { error: threadError } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', currentThreadId);
        
      if (threadError) {
        console.error("[Mobile] Error deleting thread:", threadError);
        throw threadError;
      }
      
      await onCreateNewThread();
      
      toast({
        title: "Success",
        description: "Conversation deleted successfully",
      });
      
      setShowDeleteDialog(false);
      setIsSidebarOpen(false);
    } catch (error) {
      console.error("[Mobile] Error deleting thread:", error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="mobile-chat-interface h-full flex flex-col" {...swipeHandlers}>
      <div className="mobile-chat-header flex items-center justify-between p-4 border-b bg-white">
        <button onClick={() => setIsSidebarOpen(true)} className="text-gray-600">
          <Menu className="h-6 w-6" />
        </button>
        <h2 className="text-lg font-semibold">Rūḥ</h2>
        {currentThreadId ? (
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="text-red-500 hover:text-red-700"
            aria-label="Delete conversation"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        ) : (
          <div className="w-6 h-6"></div>
        )}
      </div>

      <div
        className={`mobile-chat-sidebar fixed top-0 left-0 h-full w-3/4 bg-white shadow-md transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } z-50`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Conversations</h3>
            <button onClick={() => setIsSidebarOpen(false)} className="text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <ChatThreadList 
            userId={userId} 
            onSelectThread={onSelectThread}
            onStartNewThread={handleNewChat}
            currentThreadId={currentThreadId}
            showDeleteButtons={false}
          />
        </div>
      </div>

      <div className="mobile-chat-content flex-1 overflow-hidden">
        {initialLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="ml-2 text-muted-foreground">Loading conversation...</span>
          </div>
        ) : chatHistory.length === 0 ? (
          <EmptyChatState />
        ) : (
          <div className="chat-area flex flex-col h-full overflow-y-auto p-3">
            {chatHistory.map((message) => (
              <MobileChatMessage
                key={message.id}
                message={message}
                isOwnMessage={message.sender === 'user'}
              />
            ))}
            <div ref={chatBottomRef} />
          </div>
        )}
      </div>

      <div className="mobile-chat-input-area bg-white border-t p-4">
        <MobileChatInput
          onSendMessage={handleSendMessage}
          isLoading={loading}
          userId={userId}
          messageText={messageText}
          setMessageText={setMessageText}
          isRecording={isRecording}
          recordingTime={recordingTime}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
        />
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
};

export default MobileChatInterface;
