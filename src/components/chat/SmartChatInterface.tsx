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
import { Trash, Bug } from "lucide-react";
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
import { ChatMessage as ChatMessageType, getUserChatThreads, getThreadMessages, saveMessage } from "@/services/chatPersistenceService";
import ChatDebugPanel, { ChatDebugProvider, useChatDebug } from "./ChatDebugPanel";

type ChatMessageRole = 'user' | 'assistant' | 'error';

const SmartChatInterfaceContent = () => {
  const [chatHistory, setChatHistory] = useState<ChatMessageType[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const loadedThreadRef = useRef<string | null>(null);
  const chatDebug = useChatDebug();

  useEffect(() => {
    const onThreadChange = (event: CustomEvent) => {
      if (event.detail.threadId) {
        setCurrentThreadId(event.detail.threadId);
        loadThreadMessages(event.detail.threadId);
        chatDebug.addEvent("Thread Change", `Thread selected: ${event.detail.threadId}`, "info");
      }
    };
    
    window.addEventListener('threadSelected' as any, onThreadChange);
    
    const storedThreadId = localStorage.getItem("lastActiveChatThreadId");
    if (storedThreadId && user?.id) {
      setCurrentThreadId(storedThreadId);
      loadThreadMessages(storedThreadId);
      chatDebug.addEvent("Initialization", `Loading stored thread: ${storedThreadId}`, "info");
    } else {
      setInitialLoading(false);
      chatDebug.addEvent("Initialization", "No stored thread found, showing empty state", "info");
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
    
    if (loadedThreadRef.current === threadId) {
      chatDebug.addEvent("Thread Loading", `Thread ${threadId} already loaded, skipping`, "info");
      return;
    }
    
    setInitialLoading(true);
    chatDebug.addEvent("Thread Loading", `Loading messages for thread ${threadId}`, "info");
    
    try {
      const { data: threadData, error: threadError } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('id', threadId)
        .eq('user_id', user.id)
        .single();
        
      if (threadError || !threadData) {
        chatDebug.addEvent("Thread Loading", `Thread not found or doesn't belong to user: ${threadError?.message || "Unknown error"}`, "error");
        console.error("Thread not found or doesn't belong to user:", threadError);
        setChatHistory([]);
        setShowSuggestions(true);
        setInitialLoading(false);
        return;
      }
      
      chatDebug.addEvent("Thread Loading", `Thread ${threadId} found, fetching messages`, "success");
      const messages = await getThreadMessages(threadId);
      
      if (messages && messages.length > 0) {
        chatDebug.addEvent("Thread Loading", `Loaded ${messages.length} messages for thread ${threadId}`, "success");
        console.log(`Loaded ${messages.length} messages for thread ${threadId}`);
        setChatHistory(messages);
        setShowSuggestions(false);
        loadedThreadRef.current = threadId;
      } else {
        chatDebug.addEvent("Thread Loading", `No messages found for thread ${threadId}`, "info");
        console.log(`No messages found for thread ${threadId}`);
        setChatHistory([]);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      chatDebug.addEvent("Thread Loading", `Error loading messages: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
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
      chatDebug.addEvent("Authentication", "User not authenticated, message sending blocked", "error");
      return;
    }

    let threadId = currentThreadId;
    
    if (!threadId) {
      toast({
        title: "No conversation selected",
        description: "Please select a conversation or start a new one.",
        variant: "destructive"
      });
      chatDebug.addEvent("Thread Selection", "No thread selected for message sending", "error");
      return;
    }
    
    const tempUserMessage: ChatMessageType = {
      id: `temp-${Date.now()}`,
      thread_id: threadId,
      content: message,
      sender: 'user',
      role: 'user',
      created_at: new Date().toISOString()
    };
    
    chatDebug.addEvent("User Message", `Adding temporary message to UI: ${tempUserMessage.id}`, "info");
    setChatHistory(prev => [...prev, tempUserMessage]);
    setLoading(true);
    setProcessingStage("Analyzing your question...");
    
    try {
      let savedUserMessage: ChatMessageType | null = null;
      try {
        chatDebug.addEvent("Database", `Saving user message to thread ${threadId}`, "info");
        savedUserMessage = await saveMessage(threadId, message, 'user');
        chatDebug.addEvent("Database", `User message saved with ID: ${savedUserMessage?.id}`, "success");
        console.log("User message saved with ID:", savedUserMessage?.id);
        
        if (savedUserMessage) {
          chatDebug.addEvent("UI Update", `Replacing temporary message with saved message: ${savedUserMessage.id}`, "info");
          setChatHistory(prev => prev.map(msg => 
            msg.id === tempUserMessage.id ? savedUserMessage! : msg
          ));
        } else {
          chatDebug.addEvent("Database", "Failed to save user message - null response", "error");
          console.error("Failed to save user message - null response");
          throw new Error("Failed to save message");
        }
      } catch (saveError: any) {
        chatDebug.addEvent("Database", `Error saving user message: ${saveError.message || "Unknown error"}`, "error");
        console.error("Error saving user message:", saveError);
        toast({
          title: "Error saving message",
          description: saveError.message || "Could not save your message",
          variant: "destructive"
        });
      }
      
      chatDebug.addEvent("Query Analysis", `Analyzing query: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`, "info");
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
      
      chatDebug.addEvent("Query Analysis", `Analysis result: ${JSON.stringify(analysisDetails)}`, "success");
      console.log("Query analysis result:", queryTypes);
      
      setProcessingStage("Searching for insights...");
      chatDebug.addEvent("AI Processing", "Sending query to AI for processing", "info");
      const response = await processChatMessage(
        message, 
        user.id, 
        queryTypes, 
        threadId,
        false
      );
      
      const responseInfo = {
        role: response.role,
        hasReferences: !!response.references?.length,
        refCount: response.references?.length || 0,
        hasAnalysis: !!response.analysis,
        hasNumericResult: response.hasNumericResult,
        errorState: response.role === 'error'
      };
      
      chatDebug.addEvent("AI Processing", `Response received: ${JSON.stringify(responseInfo)}`, "success");
      console.log("Response received:", responseInfo);
      
      try {
        chatDebug.addEvent("Database", "Saving assistant response to database", "info");
        const savedResponse = await saveMessage(
          threadId,
          response.content,
          'assistant',
          response.references,
          response.analysis,
          response.hasNumericResult
        );
        
        chatDebug.addEvent("Database", `Assistant response saved with ID: ${savedResponse?.id}`, "success");
        console.log("Assistant response saved with ID:", savedResponse?.id);
        
        if (savedResponse) {
          chatDebug.addEvent("UI Update", "Adding assistant response to chat history", "info");
          setChatHistory(prev => [...prev, savedResponse]);
        } else {
          throw new Error("Failed to save assistant response");
        }
      } catch (saveError: any) {
        chatDebug.addEvent("Database", `Error saving assistant response: ${saveError.message || "Unknown error"}`, "error");
        console.error("Error saving assistant response:", saveError);
        const assistantMessage: ChatMessageType = {
          id: `temp-response-${Date.now()}`,
          thread_id: threadId,
          content: response.content,
          sender: 'assistant',
          role: 'assistant',
          created_at: new Date().toISOString(),
          reference_entries: response.references,
          analysis_data: response.analysis,
          has_numeric_result: response.hasNumericResult
        };
        
        chatDebug.addEvent("UI Update", "Adding fallback temporary assistant response to chat history", "warning");
        setChatHistory(prev => [...prev, assistantMessage]);
        console.error("Failed to save assistant response to database, using temporary message");
        
        toast({
          title: "Warning",
          description: "Response displayed but couldn't be saved to your conversation history",
          variant: "default"
        });
      }
    } catch (error: any) {
      chatDebug.addEvent("Error", `Error in message handling: ${error?.message || "Unknown error"}`, "error");
      console.error("Error sending message:", error);
      
      const errorContent = "I'm having trouble processing your request. Please try again later. " + 
               (error?.message ? `Error: ${error.message}` : "");
      
      try {
        chatDebug.addEvent("Error Handling", "Saving error message to database", "info");
        const savedErrorMessage = await saveMessage(
          threadId,
          errorContent,
          'assistant'
        );
        
        if (savedErrorMessage) {
          chatDebug.addEvent("UI Update", "Adding error message to chat history", "warning");
          setChatHistory(prev => [...prev, savedErrorMessage]);
        } else {
          const errorMessage: ChatMessageType = {
            id: `error-${Date.now()}`,
            thread_id: threadId,
            content: errorContent,
            sender: 'assistant',
            role: 'assistant',
            created_at: new Date().toISOString()
          };
          
          chatDebug.addEvent("UI Update", "Adding fallback error message to chat history", "warning");
          setChatHistory(prev => [...prev, errorMessage]);
        }
        
        chatDebug.addEvent("Error Handling", "Error message saved to database", "success");
        console.log("Error message saved to database");
      } catch (e) {
        chatDebug.addEvent("Error Handling", `Failed to save error message: ${e instanceof Error ? e.message : "Unknown error"}`, "error");
        console.error("Failed to save error message:", e);
        
        const errorMessage: ChatMessageType = {
          id: `error-${Date.now()}`,
          thread_id: threadId,
          content: errorContent,
          sender: 'assistant',
          role: 'assistant',
          created_at: new Date().toISOString()
        };
        
        chatDebug.addEvent("UI Update", "Adding last-resort error message to chat history", "warning");
        setChatHistory(prev => [...prev, errorMessage]);
      }
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
      loadedThreadRef.current = null;
      
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
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            title="Toggle debug panel"
          >
            <Bug className={`h-5 w-5 ${showDebugPanel ? 'text-primary' : ''}`} />
          </Button>
          
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
      
      {showDebugPanel && (
        <ChatDebugPanel onClose={() => setShowDebugPanel(false)} />
      )}
      
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

export default function SmartChatInterface() {
  return (
    <ChatDebugProvider>
      <SmartChatInterfaceContent />
    </ChatDebugProvider>
  );
}
