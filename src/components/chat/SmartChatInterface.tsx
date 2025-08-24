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
import { updateThreadProcessingStatus, generateThreadTitle } from "@/utils/chat/threadUtils";
import { MentalHealthInsights } from "@/hooks/use-mental-health-insights";

import { ChatMessage } from "@/types/chat";
import { getThreadMessages, saveMessage } from "@/services/chat";
import { useDebugLog } from "@/utils/debug/DebugContext";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { useChatMessageClassification, QueryCategory } from "@/hooks/use-chat-message-classification";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import { threadSafetyManager } from "@/utils/threadSafetyManager";

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
  onProcessingStateChange?: (isProcessing: boolean) => void;
}

const SmartChatInterface: React.FC<SmartChatInterfaceProps> = ({ 
  currentThreadId: propsThreadId, 
  onSelectThread, 
  onCreateNewThread, 
  userId: propsUserId, 
  mentalHealthInsights,
  onProcessingStateChange
}) => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [userMessageSent, setUserMessageSent] = useState(false);
  const [userJustSentMessage, setUserJustSentMessage] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { translate } = useTranslation();
  const loadedThreadRef = useRef<string | null>(null);
  const debugLog = useDebugLog();
  
  // Local thread state and current id
  const [localThreadId, setLocalThreadId] = useState<string | null>(null);
  
  // Track latest active thread id for guarding async UI updates
  const currentThreadIdRef = useRef<string | null>(null);
  
  // Use props for thread ID if available, otherwise manage locally
  const currentThreadId = propsThreadId ?? localThreadId;
  const effectiveUserId = propsUserId ?? user?.id;
  
  useEffect(() => {
    currentThreadIdRef.current = currentThreadId || null;
  }, [currentThreadId]);
  
  // Track active thread for safety manager
  useEffect(() => {
    threadSafetyManager.setActiveThread(currentThreadId || null);
  }, [currentThreadId]);
  
  // Use the GPT-based message classification hook
  const { classifyMessage, classification } = useChatMessageClassification();
  
  // Use streaming chat for enhanced UX
  const {
    isStreaming,
    // streamingThreadId - removed as part of thread isolation
    streamingMessages,
    currentUserMessage,
    showBackendAnimation,
    startStreamingChat,
    queryCategory,
    restoreStreamingState,
    stopStreaming,
    useThreeDotFallback,
    dynamicMessages,
    translatedDynamicMessages,
    currentMessageIndex
  } = useStreamingChat({
      threadId: currentThreadId,
    onFinalResponse: async (response, analysis, originThreadId, requestId) => {
      // Handle final streaming response scoped to its origin thread
      if (!response || !originThreadId || !effectiveUserId) {
        debugLog.addEvent("Streaming Response", "Missing required data for final response", "error");
        console.error("[Streaming] Missing response data:", { response: !!response, originThreadId: !!originThreadId, userId: !!effectiveUserId });
        return;
      }
      
      debugLog.addEvent("Streaming Response", `Final response received for ${originThreadId}: ${response.substring(0, 100)}...`, "success");

      // Keep typing indicator visible while we finalize and render the message for the active thread
      if (originThreadId === currentThreadId) {
        setLocalLoading(true, "Finalizing response...");
        updateProcessingStage("Finalizing response...");
      }
      
      // Backend persists assistant message; UI will append via realtime
      if (originThreadId === currentThreadId) {
        // Watchdog: if realtime insert doesn't arrive, persist client-side after a short delay
        try {
          setTimeout(async () => {
            // Double-check still on same thread
            if (!currentThreadIdRef.current || currentThreadIdRef.current !== originThreadId) return;

            // Has an assistant message with same content arrived?
            const { data: recent, error: recentErr } = await supabase
              .from('chat_messages')
              .select('id, content, sender, created_at')
              .eq('thread_id', originThreadId)
              .order('created_at', { ascending: false })
              .limit(5);

            if (recentErr) {
              console.warn('[Streaming Watchdog] Failed to fetch recent messages:', recentErr.message);
            }

            const alreadyExists = (recent || []).some(m => (m as any).sender === 'assistant' && (m as any).content?.trim() === response.trim());
            if (!alreadyExists) {
              // Persist safely with an idempotency_key derived from threadId + response
              try {
                const enc = new TextEncoder();
                const keySource = requestId || `${originThreadId}:${response}`;
                const digest = await crypto.subtle.digest('SHA-256', enc.encode(keySource));
                const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
                const idempotencyKey = hex.slice(0, 32);

                await supabase.from('chat_messages').upsert({
                  thread_id: originThreadId,
                  content: response,
                  sender: 'assistant',
                  role: 'assistant',
                  idempotency_key: idempotencyKey
                }, { onConflict: 'thread_id,idempotency_key' });
              } catch (e) {
                console.warn('[Streaming Watchdog] Persist fallback failed:', (e as any)?.message || e);
              }
            }

            setLocalLoading(false);
            updateProcessingStage(null);
          }, 1200);
        } catch (e) {
          console.warn('[Streaming Watchdog] Exception scheduling fallback:', (e as any)?.message || e);
          setLocalLoading(false);
          updateProcessingStage(null);
        }
      }
    },
    onError: (error) => {
      // Ensure UI never gets stuck on loader after errors
      setLocalLoading(false);
      updateProcessingStage(null);
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

  // Combined processing state for external components
  const isAnyProcessing = isLoading || isProcessing || isStreaming;
  
  // Notify parent about processing state changes
  useEffect(() => {
    if (onProcessingStateChange) {
      onProcessingStateChange(isAnyProcessing);
    }
  }, [isAnyProcessing, onProcessingStateChange]);
  

  // Realtime: append assistant messages saved by backend
  useEffect(() => {
    if (!currentThreadId) return;
    const channel = supabase
      .channel(`thread-assistant-append-${currentThreadId}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${currentThreadId}`
        },
        (payload) => {
          const m: any = payload.new;
          if (m.sender === 'assistant') {
            setChatHistory(prev => {
              if (prev.some(msg => msg.id === m.id)) return prev;
              const newMsg: ChatMessage = {
                id: m.id,
                thread_id: m.thread_id,
                content: m.content,
                sender: 'assistant',
                role: 'assistant',
                created_at: m.created_at,
                reference_entries: m.reference_entries,
                analysis_data: m.analysis_data,
                has_numeric_result: m.has_numeric_result
              } as any;
              return [...prev, newMsg];
            });
          }
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${currentThreadId}`
        },
        (payload) => {
          const m: any = payload.new;
          if (m.sender === 'assistant') {
            setChatHistory(prev => {
              const updatedMsg: ChatMessage = {
                id: m.id,
                thread_id: m.thread_id,
                content: m.content,
                sender: 'assistant',
                role: 'assistant',
                created_at: m.created_at,
                reference_entries: m.reference_entries,
                analysis_data: m.analysis_data,
                has_numeric_result: m.has_numeric_result
              } as any;
              const idx = prev.findIndex(msg => msg.id === m.id);
              if (idx === -1) {
                return [...prev, updatedMsg];
              }
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...updatedMsg } as any;
              return copy;
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentThreadId]);

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
    
    // Trigger user message sent for auto-scroll
    setUserMessageSent(true);
    setTimeout(() => setUserMessageSent(false), 200);
    
    // Set local loading state for immediate UI feedback
    setLocalLoading(true, "Analyzing your question...");
    
    // Trigger immediate auto-scroll for user message
    setUserJustSentMessage(true);
    setTimeout(() => setUserJustSentMessage(false), 100);
    try {
      // Update thread processing status to 'processing'
      await updateThreadProcessingStatus(threadId, 'processing');
      
      // Check if this is the first message in the thread
      const isFirstMessage = chatHistory.length === 1; // Only the temp message we just added
      
      // Save the user message with idempotency key
      let savedUserMessage: ChatMessage | null = null;
      try {
        const idempotencyKey = `user-${effectiveUserId}-${threadId}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        debugLog.addEvent("Database", `Saving user message to thread ${threadId} with idempotency key: ${idempotencyKey}`, "info");
        savedUserMessage = await saveMessage(
          threadId, 
          message, 
          'user', 
          effectiveUserId,
          null, // references
          undefined, // hasNumericResult
          false, // isInteractive
          undefined, // interactiveOptions
          idempotencyKey
        );
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
      
      // NO PROCESSING MESSAGE CREATION - Pure streaming behavior for all queries
      debugLog.addEvent("Database", "Using pure streaming - no processing placeholder messages", "info");
      
      // Route ALL queries to chat-with-rag (restored original design)
      debugLog.addEvent("Routing", "Using chat-with-rag for all queries with streaming", "info");
      
      // Start streaming chat for all queries
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
      
      // Streaming owns the lifecycle; ensure local loader is cleared immediately
      setLocalLoading(false);
      updateProcessingStage(null);
      
      // Auto-scroll handled by ChatArea component
      
      // Skip the rest since streaming handles the response
      return;
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
          if (threadId === currentThreadIdRef.current) {
            setChatHistory(prev => [...prev, typedErrorMessage]);
          }
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
          if (threadId === currentThreadIdRef.current) {
            setChatHistory(prev => [...prev, errorMessage]);
          }
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
        if (threadId === currentThreadIdRef.current) {
          setChatHistory(prev => [...prev, errorMessage]);
        }
      }
    } finally {
      // Clear local loading state - only if still on originating thread
      if (threadId === currentThreadIdRef.current) {
        setLocalLoading(false);
        updateProcessingStage(null);
      }
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

  // Thread-scoped loading indicator: during streaming, only show for current thread
  const showLoadingForThisThread = isLoading || isProcessing || isStreaming;

  return (
    <div className="chat-interface flex flex-col h-full">
      <div className="chat-header flex items-center justify-between py-3 px-4 border-b">
        <h2 className="text-xl font-semibold"><TranslatableText text="Rūḥ" /></h2>
        
        <div className="flex items-center gap-2">
          {showLoadingForThisThread && currentThreadId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                stopStreaming(currentThreadId);
                setLocalLoading(false);
                updateProcessingStage(null);
              }}
              aria-label="Cancel processing"
            >
              <TranslatableText text="Cancel" />
            </Button>
          )}
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
            isLoading={showLoadingForThisThread}
            processingStage={processingStage || undefined}
            threadId={currentThreadId}
            onInteractiveOptionClick={handleInteractiveOptionClick}
            onUserMessageSent={userMessageSent}
            isStreaming={isStreaming}
            streamingMessage={
              !useThreeDotFallback && dynamicMessages && dynamicMessages.length > 0 
                ? (translatedDynamicMessages[currentMessageIndex] || dynamicMessages[currentMessageIndex])
                : ''
            }
          />
        )}
        
        {/* Legacy streaming display removed - now integrated into message flow */}
      </div>
      
      <div className="chat-input-container bg-white border-t p-4">
        <ChatInput 
          onSendMessage={handleSendMessage} 
          isLoading={showLoadingForThisThread} 
          userId={effectiveUserId}
          onVoiceTranscription={handleSendMessage}
        />
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
