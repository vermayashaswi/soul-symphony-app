import React, { useState, useEffect, useRef } from "react";
import ChatInput from "./ChatInput";
import ChatArea from "./ChatArea";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';
import { useParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import ChatSuggestionButton from "./ChatSuggestionButton";
import { Separator } from "@/components/ui/separator";
import EmptyChatState from "@/components/chat/EmptyChatState";
import { useDebouncedCallback } from 'use-debounce';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import ChatDiagnostics from "./ChatDiagnostics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BugIcon, HelpCircleIcon, InfoIcon, MessagesSquareIcon, Trash } from 'lucide-react';
import DebugPanel from "@/components/debug/DebugPanel";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { updateThreadProcessingStatus, createProcessingMessage, updateProcessingMessage } from "@/utils/chat/threadUtils";
import { MentalHealthInsights } from "@/hooks/use-mental-health-insights";
import VoiceRecordingButton from "./VoiceRecordingButton";
import { ChatMessage } from "@/types/chat";
import { getThreadMessages, saveMessage } from "@/services/chat";
import { useDebugLog } from "@/utils/debug/DebugContext";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { processChatMessage } from "@/services/chatService";
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

export interface SmartChatInterfaceProps {
  mentalHealthInsights?: MentalHealthInsights;
}

const SmartChatInterface: React.FC<SmartChatInterfaceProps> = ({ mentalHealthInsights }) => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { translate } = useTranslation();
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const loadedThreadRef = useRef<string | null>(null);
  const debugLog = useDebugLog();
  
  // State for the current thread
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  
  // Use our new realtime hook to track processing status
  const {
    isProcessing,
    processingStage,
    processingStatus,
    updateProcessingStage
  } = useChatRealtime(currentThreadId);

  useEffect(() => {
    const onThreadChange = (event: CustomEvent) => {
      if (event.detail.threadId) {
        setCurrentThreadId(event.detail.threadId);
        loadThreadMessages(event.detail.threadId);
        debugLog.addEvent("Thread Change", `Thread selected: ${event.detail.threadId}`, "info");
      }
    };
    
    window.addEventListener('threadSelected' as any, onThreadChange);
    
    const storedThreadId = localStorage.getItem("lastActiveChatThreadId");
    if (storedThreadId && user?.id) {
      setCurrentThreadId(storedThreadId);
      loadThreadMessages(storedThreadId);
      debugLog.addEvent("Initialization", `Loading stored thread: ${storedThreadId}`, "info");
    } else {
      setInitialLoading(false);
      debugLog.addEvent("Initialization", "No stored thread found, showing empty state", "info");
    }
    
    return () => {
      window.removeEventListener('threadSelected' as any, onThreadChange);
    };
  }, [user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, loading, isProcessing]);

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
      debugLog.addEvent("Thread Loading", `Thread ${threadId} already loaded, skipping`, "info");
      return;
    }
    
    setInitialLoading(true);
    debugLog.addEvent("Thread Loading", `Loading messages for thread ${threadId}`, "info");
    
    try {
      const { data: threadData, error: threadError } = await supabase
        .from('chat_threads')
        .select('id, processing_status')
        .eq('id', threadId)
        .eq('user_id', user.id)
        .single();
        
      if (threadError || !threadData) {
        debugLog.addEvent("Thread Loading", `Thread not found or doesn't belong to user: ${threadError?.message || "Unknown error"}`, "error");
        console.error("Thread not found or doesn't belong to user:", threadError);
        setChatHistory([]);
        setShowSuggestions(true);
        setInitialLoading(false);
        return;
      }
      
      debugLog.addEvent("Thread Loading", `Thread ${threadId} found, fetching messages`, "success");
      const messages = await getThreadMessages(threadId);
      
      if (messages && messages.length > 0) {
        debugLog.addEvent("Thread Loading", `Loaded ${messages.length} messages for thread ${threadId}`, "success");
        console.log(`Loaded ${messages.length} messages for thread ${threadId}`);
        
        // Convert the messages to the correct type
        const typedMessages: ChatMessage[] = messages.map(msg => ({
          ...msg,
          sender: msg.sender as 'user' | 'assistant' | 'error',
          role: msg.role as 'user' | 'assistant' | 'error'
        }));
        
        setChatHistory(typedMessages);
        setShowSuggestions(false);
        loadedThreadRef.current = threadId;
        
        // If the thread is in processing state, update the local state accordingly
        if (threadData.processing_status === 'processing') {
          debugLog.addEvent("Thread Loading", `Thread ${threadId} is in processing state`, "info");
          setLoading(true);
          updateProcessingStage("Retrieving information...");
        }
      } else {
        debugLog.addEvent("Thread Loading", `No messages found for thread ${threadId}`, "info");
        console.log(`No messages found for thread ${threadId}`);
        setChatHistory([]);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      debugLog.addEvent("Thread Loading", `Error loading messages: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
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

  const handleSendMessage = async (message: string, parameters: Record<string, any> = {}) => {
    if (!message.trim()) return;
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please sign in to use the chat feature.",
        variant: "destructive"
      });
      debugLog.addEvent("Authentication", "User not authenticated, message sending blocked", "error");
      return;
    }

    let threadId = currentThreadId;
    
    if (!threadId) {
      toast({
        title: "No conversation selected",
        description: "Please select a conversation or start a new one.",
        variant: "destructive"
      });
      debugLog.addEvent("Thread Selection", "No thread selected for message sending", "error");
      return;
    }
    
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      thread_id: threadId,
      content: message,
      sender: 'user',
      role: 'user',
      created_at: new Date().toISOString()
    };
    
    debugLog.addEvent("User Message", `Adding temporary message to UI: ${tempUserMessage.id}`, "info");
    setChatHistory(prev => [...prev, tempUserMessage]);
    setLoading(true);
    updateProcessingStage("Analyzing your question...");
    
    try {
      // Update thread processing status to 'processing'
      await updateThreadProcessingStatus(threadId, 'processing');
      
      // Save the user message
      let savedUserMessage: ChatMessage | null = null;
      try {
        debugLog.addEvent("Database", `Saving user message to thread ${threadId}`, "info");
        savedUserMessage = await saveMessage(threadId, message, 'user');
        debugLog.addEvent("Database", `User message saved with ID: ${savedUserMessage?.id}`, "success");
        console.log("User message saved with ID:", savedUserMessage?.id);
        
        if (savedUserMessage) {
          debugLog.addEvent("UI Update", `Replacing temporary message with saved message: ${savedUserMessage.id}`, "info");
          setChatHistory(prev => prev.map(msg => 
            msg.id === tempUserMessage.id ? {
              ...savedUserMessage!,
              sender: savedUserMessage!.sender as 'user' | 'assistant' | 'error',
              role: savedUserMessage!.role as 'user' | 'assistant' | 'error'
            } : msg
          ));
        } else {
          debugLog.addEvent("Database", "Failed to save user message - null response", "error");
          console.error("Failed to save user message - null response");
          throw new Error("Failed to save message");
        }
      } catch (saveError: any) {
        debugLog.addEvent("Database", `Error saving user message: ${saveError.message || "Unknown error"}`, "error");
        console.error("Error saving user message:", saveError);
        toast({
          title: "Error saving message",
          description: saveError.message || "Could not save your message",
          variant: "destructive"
        });
      }
      
      // Create a processing message placeholder
      const processingMessageId = await createProcessingMessage(threadId, "Processing your request...");
      
      if (processingMessageId) {
        debugLog.addEvent("Database", `Created processing message with ID: ${processingMessageId}`, "success");
        // We don't need to add it to the UI since it will come through the realtime subscription
      }
      
      debugLog.addEvent("Query Analysis", `Analyzing query: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`, "info");
      console.log("Performing comprehensive query analysis for:", message);
      updateProcessingStage("Analyzing patterns in your journal...");
      const queryTypes = analyzeQueryTypes(message);
      
      const analysisDetails = {
        isEmotionFocused: queryTypes.isEmotionFocused,
        isQuantitative: queryTypes.isQuantitative,
        isWhyQuestion: queryTypes.isWhyQuestion,
        isTemporalQuery: queryTypes.isTemporalQuery,
        isPersonalInsightQuery: queryTypes.isPersonalInsightQuery, // New field
        isMentalHealthQuery: queryTypes.isMentalHealthQuery,       // New field  
        timeRange: queryTypes.timeRange.periodName,
        emotion: queryTypes.emotion || 'none detected'
      };
      
      debugLog.addEvent("Query Analysis", `Analysis result: ${JSON.stringify(analysisDetails)}`, "success");
      console.log("Query analysis result:", queryTypes);
      
      updateProcessingStage("Planning search strategy...");
      debugLog.addEvent("Query Planning", "Breaking down complex query into sub-queries if needed", "info");
      
      updateProcessingStage("Searching for insights...");
      debugLog.addEvent("Context-Aware Processing", "Sending query with conversation context", "info");
      
      // Always use personal insights for mental health and personality questions
      const forcePersonalContext = queryTypes.isPersonalInsightQuery || queryTypes.isMentalHealthQuery;
      if (forcePersonalContext) {
        parameters.usePersonalContext = true;
        debugLog.addEvent("Query Enhancement", "Forcing personal context for mental health or personality question", "info");
      }
      
      const response = await processChatMessage(
        message, 
        user.id, 
        queryTypes, 
        threadId,
        false,
        parameters
      );
      
      // Update or delete the processing message
      if (processingMessageId) {
        await updateProcessingMessage(
          processingMessageId,
          response.content,
          response.references,
          response.analysis,
          response.hasNumericResult
        );
      }
      
      // Update thread processing status to 'idle'
      await updateThreadProcessingStatus(threadId, 'idle');
      
      // Handle interactive clarification messages
      if (response.isInteractive && response.interactiveOptions) {
        debugLog.addEvent("AI Processing", "Received interactive clarification message", "info");
        try {
          const savedResponse = await saveMessage(
            threadId,
            response.content,
            'assistant',
            undefined,
            undefined,
            false,
            true,
            response.interactiveOptions
          );
          
          if (savedResponse) {
            debugLog.addEvent("Database", `Interactive message saved with ID: ${savedResponse.id}`, "success");
            const typedSavedResponse: ChatMessage = {
              ...savedResponse,
              sender: savedResponse.sender as 'user' | 'assistant' | 'error',
              role: savedResponse.role as 'user' | 'assistant' | 'error',
              isInteractive: true,
              interactiveOptions: response.interactiveOptions
            };
            setChatHistory(prev => [...prev, typedSavedResponse]);
          } else {
            throw new Error("Failed to save interactive message");
          }
        } catch (saveError: any) {
          debugLog.addEvent("Database", `Error saving interactive message: ${saveError.message}`, "error");
          
          // Fallback to displaying the message without saving it
          const interactiveMessage: ChatMessage = {
            id: `temp-interactive-${Date.now()}`,
            thread_id: threadId,
            content: response.content,
            sender: 'assistant',
            role: 'assistant',
            created_at: new Date().toISOString(),
            isInteractive: true,
            interactiveOptions: response.interactiveOptions
          };
          
          setChatHistory(prev => [...prev, interactiveMessage]);
        }
      } else {
        const responseInfo = {
          role: response.role,
          hasReferences: !!response.references?.length,
          refCount: response.references?.length || 0,
          hasAnalysis: !!response.analysis,
          hasNumericResult: response.hasNumericResult,
          errorState: response.role === 'error'
        };
        
        debugLog.addEvent("AI Processing", `Response received: ${JSON.stringify(responseInfo)}`, "success");
        console.log("Response received:", responseInfo);
        
        try {
          debugLog.addEvent("Database", "Saving assistant response to database", "info");
          const savedResponse = await saveMessage(
            threadId,
            response.content,
            'assistant',
            response.references,
            response.analysis,
            response.hasNumericResult
          );
          
          debugLog.addEvent("Database", `Assistant response saved with ID: ${savedResponse?.id}`, "success");
          console.log("Assistant response saved with ID:", savedResponse?.id);
          
          if (savedResponse) {
            debugLog.addEvent("UI Update", "Adding assistant response to chat history", "info");
            const typedSavedResponse: ChatMessage = {
              ...savedResponse,
              sender: savedResponse.sender as 'user' | 'assistant' | 'error',
              role: savedResponse.role as 'user' | 'assistant' | 'error'
            };
            setChatHistory(prev => [...prev, typedSavedResponse]);
          } else {
            throw new Error("Failed to save assistant response");
          }
        } catch (saveError: any) {
          debugLog.addEvent("Database", `Error saving assistant response: ${saveError.message || "Unknown error"}`, "error");
          console.error("Error saving assistant response:", saveError);
          const assistantMessage: ChatMessage = {
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
          
          debugLog.addEvent("UI Update", "Adding fallback temporary assistant response to chat history", "warning");
          setChatHistory(prev => [...prev, assistantMessage]);
          console.error("Failed to save assistant response to database, using temporary message");
          
          toast({
            title: "Warning",
            description: "Response displayed but couldn't be saved to your conversation history",
            variant: "default"
          });
        }
      }
    } catch (error: any) {
      debugLog.addEvent("Error", `Error in message handling: ${error?.message || "Unknown error"}`, "error");
      console.error("Error sending message:", error);
      
      // Update thread status to failed
      if (threadId) {
        await updateThreadProcessingStatus(threadId, 'failed');
      }
      
      const errorContent = "I'm having trouble processing your request. Please try again later. " + 
               (error?.message ? `Error: ${error.message}` : "");
      
      try {
        debugLog.addEvent("Error Handling", "Saving error message to database", "info");
        const savedErrorMessage = await saveMessage(
          threadId,
          errorContent,
          'assistant'
        );
        
        if (savedErrorMessage) {
          debugLog.addEvent("UI Update", "Adding error message to chat history", "warning");
          const typedErrorMessage: ChatMessage = {
            ...savedErrorMessage,
            sender: 'assistant',
            role: 'assistant'
          };
          setChatHistory(prev => [...prev, typedErrorMessage]);
        } else {
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            thread_id: threadId,
            content: errorContent,
            sender: 'assistant',
            role: 'assistant',
            created_at: new Date().toISOString()
          };
          
          debugLog.addEvent("UI Update", "Adding fallback error message to chat history", "warning");
          setChatHistory(prev => [...prev, errorMessage]);
        }
        
        debugLog.addEvent("Error Handling", "Error message saved to database", "success");
        console.log("Error message saved to database");
      } catch (e) {
        debugLog.addEvent("Error Handling", `Failed to save error message: ${e instanceof Error ? e.message : "Unknown error"}`, "error");
        console.error("Failed to save error message:", e);
        
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          thread_id: threadId,
          content: errorContent,
          sender: 'assistant',
          role: 'assistant',
          created_at: new Date().toISOString()
        };
        
        debugLog.addEvent("UI Update", "Adding last-resort error message to chat history", "warning");
        setChatHistory(prev => [...prev, errorMessage]);
      }
    } finally {
      setLoading(false);
      updateProcessingStage(null);
    }
  };

  const handleInteractiveOptionClick = (option: any) => {
    if (!option || !option.action) return;
    
    debugLog.addEvent("Interactive Option", `User clicked: ${option.text}`, "info");
    
    switch (option.action) {
      case 'expand_search':
        // Re-run the last message with historical data parameter
        const lastUserMessage = [...chatHistory]
          .reverse()
          .find(msg => msg.role === 'user' || msg.sender === 'user');
        
        if (lastUserMessage?.content) {
          debugLog.addEvent("Search Expansion", "Re-running query with expanded historical scope", "info");
          handleSendMessage(`${lastUserMessage.content} (searching all historical data)`, { useHistoricalData: true });
        }
        break;
        
      case 'default_search':
        // Re-run with default parameters
        const lastMsg = [...chatHistory]
          .reverse()
          .find(msg => msg.role === 'user' || msg.sender === 'user');
          
        if (lastMsg?.content) {
          debugLog.addEvent("Search Default", "Re-running query with default time scope", "info");
          handleSendMessage(`${lastMsg.content} (recent entries only)`, { useHistoricalData: false });
        }
        break;
        
      default:
        console.warn("Unknown interactive action:", option.action);
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

      // Fetch the most recent thread for this user, after deletion
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
        window.dispatchEvent(
          new CustomEvent('threadSelected', { 
            detail: { threadId: threads[0].id } 
          })
        );
      } else {
        // Create a new thread if none remain
        const { data: newThread, error: insertError } = await supabase
          .from('chat_threads')
          .insert({
            user_id: user.id,
            title: "New Conversation",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!insertError && newThread) {
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
        <h2 className="text-xl font-semibold"><TranslatableText text="Rūḥ" /></h2>
        
        <div className="flex items-center gap-2">
          {currentThreadId && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20" 
              onClick={() => setShowDeleteDialog(true)}
              aria-label="Delete conversation"
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
            <span className="ml-2 text-muted-foreground"><TranslatableText text="Loading conversation..." /></span>
          </div>
        ) : chatHistory.length === 0 ? (
          <EmptyChatState />
        ) : (
          <ChatArea 
            chatMessages={chatHistory}
            isLoading={loading || isProcessing}
            processingStage={processingStage || undefined}
            threadId={currentThreadId}
            onInteractiveOptionClick={handleInteractiveOptionClick}
          />
        )}
      </div>
      
      <div className="chat-input-container bg-white border-t p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <ChatInput 
              onSendMessage={handleSendMessage} 
              isLoading={loading || isProcessing} 
              userId={user?.id}
            />
          </div>
          <VoiceRecordingButton 
            isLoading={loading || isProcessing}
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

// Export both the raw component and a wrapper component
export { SmartChatInterface };  // Named export for direct import by other components

// Default export as a wrapper component
export default SmartChatInterface;
