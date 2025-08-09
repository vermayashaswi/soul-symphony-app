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
import { updateThreadProcessingStatus, createProcessingMessage, updateProcessingMessage, generateThreadTitle } from "@/utils/chat/threadUtils";
import { MentalHealthInsights } from "@/hooks/use-mental-health-insights";
import VoiceRecordingButton from "./VoiceRecordingButton";
import { ChatMessage } from "@/types/chat";
import { getThreadMessages, saveMessage } from "@/services/chat";
import { useDebugLog } from "@/utils/debug/DebugContext";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { useChatMessageClassification, QueryCategory } from "@/hooks/use-chat-message-classification";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface SmartChatInterfaceProps {
  currentThreadId?: string | null;
  onSelectThread?: (threadId: string) => void;
  onCreateNewThread?: () => Promise<string | null>;
  userId?: string;
  mentalHealthInsights?: MentalHealthInsights;
}

const SmartChatInterface: React.FC<SmartChatInterfaceProps> = ({ 
  currentThreadId: propsThreadId, 
  onSelectThread, 
  onCreateNewThread, 
  userId: propsUserId, 
  mentalHealthInsights 
}) => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { translate } = useTranslation();
  const loadedThreadRef = useRef<string | null>(null);
  const debugLog = useDebugLog();
  
  // Use props for thread ID if available, otherwise manage locally
  const [localThreadId, setLocalThreadId] = useState<string | null>(null);
  const currentThreadId = propsThreadId ?? localThreadId;
  const effectiveUserId = propsUserId ?? user?.id;
  
  // Use the GPT-based message classification hook
  const { classifyMessage, classification } = useChatMessageClassification();
  
  // Use streaming chat for enhanced UX
  const {
    isStreaming,
    streamingMessages,
    currentUserMessage,
    showBackendAnimation,
    startStreamingChat,
    queryCategory,
    restoreStreamingState
  } = useStreamingChat({
    onFinalResponse: async (response, analysis) => {
      // Handle final streaming response
      if (!response || !currentThreadId || !effectiveUserId) {
        debugLog.addEvent("Streaming Response", "Missing required data for final response", "error");
        console.error("[Streaming] Missing response data:", { response: !!response, threadId: !!currentThreadId, userId: !!effectiveUserId });
        return;
      }
      
      debugLog.addEvent("Streaming Response", `Final response received: ${response.substring(0, 100)}...`, "success");
      
      try {
        // Save the assistant response to database
        debugLog.addEvent("Database", "Saving streaming assistant response to database", "info");
        const savedResponse = await saveMessage(
          currentThreadId,
          response,
          'assistant',
          effectiveUserId,
          analysis?.references || undefined,
          analysis?.hasNumericResult || false
        );
        
        if (savedResponse) {
          debugLog.addEvent("Database", `Streaming assistant response saved with ID: ${savedResponse.id}`, "success");
          
          // Add the saved response to chat history
          const typedSavedResponse: ChatMessage = {
            ...savedResponse,
            sender: savedResponse.sender as 'user' | 'assistant' | 'error',
            role: savedResponse.role as 'user' | 'assistant' | 'error'
          };
          setChatHistory(prev => [...prev, typedSavedResponse]);
        } else {
          debugLog.addEvent("Database", "Failed to save streaming response - null response", "error");
          throw new Error("Failed to save streaming response");
        }
      } catch (saveError) {
        debugLog.addEvent("Database", `Error saving streaming response: ${saveError instanceof Error ? saveError.message : "Unknown error"}`, "error");
        console.error("[Streaming] Failed to save response:", saveError);
        
        // Fallback: Add temporary message to UI
        const fallbackMessage: ChatMessage = {
          id: `temp-streaming-${Date.now()}`,
          thread_id: currentThreadId,
          content: response,
          sender: 'assistant',
          role: 'assistant',
          created_at: new Date().toISOString()
        };
        setChatHistory(prev => [...prev, fallbackMessage]);
        
        toast({
          title: "Warning",
          description: "Response displayed but couldn't be saved to your conversation history",
          variant: "default"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error,
        variant: "destructive"
      });
    }
  });
  
  // Use our enhanced realtime hook to track processing status
  const {
    isLoading,
    isProcessing,
    processingStage,
    processingStatus,
    updateProcessingStage,
    setLocalLoading
  } = useChatRealtime(currentThreadId);
  
  // Use unified auto-scroll hook
  const { scrollElementRef, scrollToBottom } = useAutoScroll({
    dependencies: [chatHistory, isLoading, isProcessing, isStreaming, streamingMessages],
    delay: 50,
    scrollThreshold: 100
  });

  // Sync with props thread ID and update local storage
  useEffect(() => {
    if (propsThreadId && propsThreadId !== currentThreadId) {
      loadThreadMessages(propsThreadId);
      // Try to restore streaming state for this thread
      const restored = restoreStreamingState(propsThreadId);
      if (restored) {
        debugLog.addEvent("Props Thread Change", `Restored streaming state for props thread: ${propsThreadId}`, "info");
      }
      // Update local storage to maintain consistency
      if (propsThreadId) {
        localStorage.setItem("lastActiveChatThreadId", propsThreadId);
      }
      debugLog.addEvent("Props Thread Change", `Thread selected via props: ${propsThreadId}`, "info");
    }
  }, [propsThreadId, currentThreadId, restoreStreamingState]);

  useEffect(() => {
    // Only handle events and local storage if not using props
    if (propsThreadId) return;
    
    const onThreadChange = (event: CustomEvent) => {
      if (event.detail.threadId) {
        setLocalThreadId(event.detail.threadId);
        loadThreadMessages(event.detail.threadId);
        // Use the callback if available
        if (onSelectThread) {
          onSelectThread(event.detail.threadId);
        }
        debugLog.addEvent("Thread Change", `Thread selected: ${event.detail.threadId}`, "info");
      }
    };
    
    window.addEventListener('threadSelected' as any, onThreadChange);
    
    const storedThreadId = localStorage.getItem("lastActiveChatThreadId");
    if (storedThreadId && effectiveUserId) {
      setLocalThreadId(storedThreadId);
      loadThreadMessages(storedThreadId);
      // Try to restore streaming state for stored thread
      const restored = restoreStreamingState(storedThreadId);
      if (restored) {
        debugLog.addEvent("Initialization", `Restored streaming state for stored thread: ${storedThreadId}`, "info");
      }
      debugLog.addEvent("Initialization", `Loading stored thread: ${storedThreadId}`, "info");
    } else {
      setInitialLoading(false);
      debugLog.addEvent("Initialization", "No stored thread found, showing empty state", "info");
    }
    
    return () => {
      window.removeEventListener('threadSelected' as any, onThreadChange);
    };
  }, [effectiveUserId, propsThreadId]);

  // Auto-scroll is now handled by the useAutoScroll hook

  const loadThreadMessages = async (threadId: string) => {
    if (!threadId || !effectiveUserId) {
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
        .select('id')
        .eq('id', threadId)
        .eq('user_id', effectiveUserId)
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
      const messages = await getThreadMessages(threadId, effectiveUserId);
      
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
    if (!effectiveUserId) {
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
      // If no thread exists, try to create one if we have the callback
      if (onCreateNewThread) {
        debugLog.addEvent("Thread Creation", "No thread selected, creating new thread", "info");
        const newThreadId = await onCreateNewThread();
        if (newThreadId) {
          threadId = newThreadId;
          if (!propsThreadId) {
            setLocalThreadId(newThreadId);
          }
        } else {
          toast({
            title: "Error",
            description: "Failed to create new conversation",
            variant: "destructive"
          });
          return;
        }
      } else {
        toast({
          title: "No conversation selected",
          description: "Please select a conversation or start a new one.",
          variant: "destructive"
        });
        debugLog.addEvent("Thread Selection", "No thread selected for message sending", "error");
        return;
      }
    }
    
    // Prevent multiple concurrent requests
    if (isProcessing || isLoading) {
      toast({
        title: "Please wait",
        description: "Another request is currently being processed.",
        variant: "default"
      });
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
    
    // Set local loading state for immediate UI feedback
    setLocalLoading(true, "Analyzing your question...");
    
    try {
      // Update thread processing status to 'processing'
      await updateThreadProcessingStatus(threadId, 'processing');
      
      // Check if this is the first message in the thread
      const isFirstMessage = chatHistory.length === 1; // Only the temp message we just added
      
      // Save the user message
      let savedUserMessage: ChatMessage | null = null;
      try {
        debugLog.addEvent("Database", `Saving user message to thread ${threadId}`, "info");
        savedUserMessage = await saveMessage(threadId, message, 'user', effectiveUserId);
        debugLog.addEvent("Database", `User message saved with ID: ${savedUserMessage?.id}`, "success");
        
        if (savedUserMessage) {
          debugLog.addEvent("UI Update", `Replacing temporary message with saved message: ${savedUserMessage.id}`, "info");
          setChatHistory(prev => prev.map(msg => 
            msg.id === tempUserMessage.id ? {
              ...savedUserMessage!,
              sender: savedUserMessage!.sender as 'user' | 'assistant' | 'error',
              role: savedUserMessage!.role as 'user' | 'assistant' | 'error'
            } : msg
          ));
          
          // Generate title for the first message in a thread
          if (isFirstMessage) {
            try {
              debugLog.addEvent("Title Generation", "Generating thread title after first message", "info");
              const generatedTitle = await generateThreadTitle(threadId, effectiveUserId);
              if (generatedTitle) {
                // Dispatch event to update sidebar
                window.dispatchEvent(
                  new CustomEvent('threadTitleUpdated', {
                    detail: { threadId, title: generatedTitle }
                  })
                );
                debugLog.addEvent("Title Generation", `Generated title: ${generatedTitle}`, "success");
              }
            } catch (titleError) {
              debugLog.addEvent("Title Generation", `Failed to generate title: ${titleError instanceof Error ? titleError.message : "Unknown error"}`, "error");
              console.warn('Failed to generate thread title:', titleError);
            }
          }
        } else {
          debugLog.addEvent("Database", "Failed to save user message - null response", "error");
          throw new Error("Failed to save message");
        }
      } catch (saveError: any) {
        debugLog.addEvent("Database", `Error saving user message: ${saveError.message || "Unknown error"}`, "error");
        toast({
          title: "Error saving message",
          description: saveError.message || "Could not save your message",
          variant: "destructive"
        });
      }
      
      // Initialize processing message placeholder (only created for non-journal queries)
      let processingMessageId: string | null = null;
      
      // Use GPT-based query classification with conversation context
      debugLog.addEvent("Query Classification", `Classifying query: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`, "info");
      updateProcessingStage("Analyzing your question...");
      
      // Get conversation context for better classification
      const conversationContext = chatHistory.slice(-5).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      const queryClassification = await classifyMessage(message, conversationContext);
      
      debugLog.addEvent("Query Classification", `Classification result: ${JSON.stringify({
        category: queryClassification.category,
        confidence: queryClassification.confidence,
        useAllEntries: queryClassification.useAllEntries,
        reasoning: queryClassification.reasoning
      })}` , "success");
      
      updateProcessingStage("Generating response...");
      
      // Create processing placeholder only for non-journal-specific queries
      if (queryClassification.category !== QueryCategory.JOURNAL_SPECIFIC) {
        processingMessageId = await createProcessingMessage(threadId, "Processing your request...");
        if (processingMessageId) {
          debugLog.addEvent("Database", `Created processing message with ID: ${processingMessageId}`, "success");
        }
      } else if (processingMessageId) {
        // Safety: if a placeholder exists, remove it for streaming path
        await updateProcessingMessage(processingMessageId, null);
        processingMessageId = null;
      }
      
      let response;
      // Route to appropriate edge function based on classification
      if (queryClassification.category === QueryCategory.JOURNAL_SPECIFIC) {
        debugLog.addEvent("Routing", "Using chat-with-rag for journal-specific query with streaming", "info");
        
        // Start streaming chat for enhanced UX
        await startStreamingChat(
          message,
          effectiveUserId,
          threadId,
          conversationContext,
          {
            useAllEntries: queryClassification.useAllEntries || false,
            hasPersonalPronouns: message.toLowerCase().includes('i ') || message.toLowerCase().includes('my '),
            hasExplicitTimeReference: /\b(last week|yesterday|this week|last month|today|recently|lately)\b/i.test(message),
            threadMetadata: {}
          }
        );
        
        // Skip the rest since streaming handles the response
        return;
        
        // This code block is no longer needed as streaming handles the response
        
      } else if (queryClassification.category === QueryCategory.GENERAL_MENTAL_HEALTH) {
        debugLog.addEvent("Routing", "Using general-mental-health-chat for mental health query", "info");
        
        // Call general-mental-health-chat edge function
        const { data, error } = await supabase.functions.invoke('general-mental-health-chat', {
          body: {
            message,
            conversationContext,
            userInsights: mentalHealthInsights
          }
        });
        
        if (error) {
          throw new Error(`Mental health chat error: ${error.message}`);
        }
        
        response = {
          content: data.response,
          references: [],
          analysis: {},
          hasNumericResult: false,
          role: 'assistant' as const
        };
        
      } else {
        // CONVERSATIONAL - use smart-chat for general conversation
        debugLog.addEvent("Routing", "Using smart-chat for conversational query", "info");
        
        const { data, error } = await supabase.functions.invoke('smart-chat', {
          body: {
            message,
            conversationContext
          }
        });
        
        debugLog.addEvent("Edge Function Response", `Smart-chat response: ${JSON.stringify({
          hasData: !!data,
          hasError: !!error,
          errorMessage: error?.message,
          dataKeys: data ? Object.keys(data) : [],
          responseLength: data?.response?.length || 0
        })}`, data ? "success" : "error");
        
        if (error) {
          throw new Error(`Smart chat error: ${error.message}`);
        }
        
        if (!data || !data.response) {
          debugLog.addEvent("Edge Function Response", "Smart-chat returned no response data", "error");
          throw new Error("No response received from smart-chat function");
        }
        
        response = {
          content: data.response,
          references: [],
          analysis: {},
          hasNumericResult: false,
          role: 'assistant' as const
        };
        
        debugLog.addEvent("Response Processing", `Created response object: ${JSON.stringify({
          contentLength: response.content?.length || 0,
          hasReferences: !!response.references?.length,
          role: response.role
        })}`, "success");
      }
      
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
            effectiveUserId,
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
        
        try {
          debugLog.addEvent("Database", "Saving assistant response to database", "info");
          const savedResponse = await saveMessage(
            threadId,
            response.content,
            'assistant',
            effectiveUserId,
            response.references,
            response.hasNumericResult
          );
          
          debugLog.addEvent("Database", `Assistant response saved with ID: ${savedResponse?.id}`, "success");
          
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
          
          toast({
            title: "Warning",
            description: "Response displayed but couldn't be saved to your conversation history",
            variant: "default"
          });
        }
      }
    } catch (error: any) {
      debugLog.addEvent("Error", `Error in message handling: ${error?.message || "Unknown error"}`, "error");
      
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
          'assistant',
          effectiveUserId
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
      } catch (e) {
        debugLog.addEvent("Error Handling", `Failed to save error message: ${e instanceof Error ? e.message : "Unknown error"}`, "error");
        
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
      // Clear local loading state - the realtime hook will handle the final state
      setLocalLoading(false);
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
    if (!currentThreadId || !effectiveUserId) {
      toast({
        title: "Error",
        description: "No active conversation to delete",
        variant: "destructive"
      });
      return;
    }

    // Prevent deletion if currently processing
    if (isProcessing || processingStatus === 'processing') {
      toast({
        title: "Cannot delete conversation",
        description: "Please wait for the current request to complete before deleting this conversation.",
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
        .eq('user_id', effectiveUserId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (threads && threads.length > 0) {
        if (!propsThreadId) {
          setLocalThreadId(threads[0].id);
        }
        if (onSelectThread) {
          onSelectThread(threads[0].id);
        }
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
            user_id: effectiveUserId,
            title: "New Conversation",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!insertError && newThread) {
          if (!propsThreadId) {
            setLocalThreadId(newThread.id);
          }
          if (onSelectThread) {
            onSelectThread(newThread.id);
          }
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

  // Check if deletion should be disabled - use realtime processing state
  const isDeletionDisabled = isProcessing || processingStatus === 'processing' || isLoading;

  return (
    <div className="chat-interface flex flex-col h-full">
      <div className="chat-header flex items-center justify-between py-3 px-4 border-b">
        <h2 className="text-xl font-semibold"><TranslatableText text="Rūḥ" /></h2>
        
        <div className="flex items-center gap-2">
          {currentThreadId && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-9 w-9 ${
                      isDeletionDisabled 
                        ? 'text-muted-foreground/50 cursor-not-allowed' 
                        : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20'
                    }`}
                    onClick={() => !isDeletionDisabled && setShowDeleteDialog(true)}
                    disabled={isDeletionDisabled}
                    aria-label="Delete conversation"
                  >
                    <Trash className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isDeletionDisabled ? (
                    <TranslatableText text="Cannot delete while processing" />
                  ) : (
                    <TranslatableText text="Delete conversation" />
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
            isLoading={isLoading || isProcessing}
            processingStage={processingStage || undefined}
            threadId={currentThreadId}
            onInteractiveOptionClick={handleInteractiveOptionClick}
          />
        )}
        
        {/* Legacy streaming display removed - now integrated into message flow */}
      </div>
      
      <div className="chat-input-container bg-white border-t p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <ChatInput 
              onSendMessage={handleSendMessage} 
              isLoading={isLoading || isProcessing} 
              userId={effectiveUserId}
            />
          </div>
          <VoiceRecordingButton 
            isLoading={isLoading || isProcessing}
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
