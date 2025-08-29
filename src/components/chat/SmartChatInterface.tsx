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
import { ChatRecoveryButton } from './ChatRecoveryButton';
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

import { ChatMessage } from "@/types/chat";
import { getThreadMessages, saveMessage } from "@/services/chat";
import { useDebugLog } from "@/utils/debug/DebugContext";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { useChatMessageClassification, QueryCategory } from "@/hooks/use-chat-message-classification";
import { useStreamingChatV2 } from "@/hooks/useStreamingChatV2";
import { threadSafetyManager } from "@/utils/threadSafetyManager";
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
    streamingMessages,
    lastUserInput: currentUserMessage,
    showDynamicMessages: showBackendAnimation,
    startStreamingChat,
    queryCategory,
    dynamicMessages,
    translatedDynamicMessages,
    currentMessageIndex,
    useThreeDotFallback,
    stopStreaming,
    forceRecovery,
    isStuck
  } = useStreamingChatV2(currentThreadId || '', {
    onFinalResponse: async (response) => {
      // Handle final streaming response
      if (!response || !currentThreadId || !effectiveUserId) {
        debugLog.addEvent("Streaming Response", "Missing required data for final response", "error");
        console.error("[Streaming] Missing response data:", { response: !!response, threadId: !!currentThreadId, userId: !!effectiveUserId });
        return;
      }
      
      debugLog.addEvent("Streaming Response", `Final response received for ${currentThreadId}: ${response.substring(0, 100)}...`, "success");

      // NO manual loading states - useStreamingChat handles everything
      
      // Backend persists assistant message; UI will append via realtime
      // Watchdog: if realtime insert doesn't arrive, persist client-side after a short delay
      try {
        setTimeout(async () => {
          // Double-check still on same thread
          if (!currentThreadIdRef.current || currentThreadIdRef.current !== currentThreadId) return;

          // Has an assistant message with same content arrived?
          const { data: recent, error: recentErr } = await supabase
            .from('chat_messages')
            .select('id, content, sender, created_at')
            .eq('thread_id', currentThreadId)
            .order('created_at', { ascending: false })
            .limit(5);

          if (recentErr) {
            console.warn('[Streaming Watchdog] Failed to fetch recent messages:', recentErr.message);
          }

          const responseText = typeof response === 'string' ? response : response?.content || '';
          const alreadyExists = (recent || []).some(m => (m as any).sender === 'assistant' && (m as any).content?.trim() === responseText.trim());
          if (!alreadyExists) {
            // Persist safely with an idempotency_key derived from threadId + response
            try {
              const enc = new TextEncoder();
              const keySource = `${currentThreadId}:${responseText}`;
              const digest = await crypto.subtle.digest('SHA-256', enc.encode(keySource));
              const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
              const idempotencyKey = hex.slice(0, 32);

              await supabase.from('chat_messages').upsert({
                thread_id: currentThreadId,
                content: responseText,
                sender: 'assistant',
                role: 'assistant',
                idempotency_key: idempotencyKey
              }, { onConflict: 'thread_id,idempotency_key' });
            } catch (e) {
              console.warn('[Streaming Watchdog] Persist fallback failed:', (e as any)?.message || e);
            }
          }
        }, 1200);
      } catch (e) {
        console.warn('[Streaming Watchdog] Exception scheduling fallback:', (e as any)?.message || e);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: typeof error === 'string' ? error : error?.message || 'Unknown error',
        variant: "destructive"
      });
    }
  });
  
  // Use realtime hook ONLY for message subscriptions (NO processing states)
  const {
    // Only used for message subscription management
  } = useChatRealtime(currentThreadId);
  
  // Use unified auto-scroll hook - ONLY useStreamingChat dependencies
  const { scrollElementRef, scrollToBottom } = useAutoScroll({
    dependencies: [chatHistory, isStreaming, streamingMessages],
    delay: 50,
    scrollThreshold: 100
  });

  // Notify parent of processing state changes - ONLY useStreamingChat states
  useEffect(() => {
    const isProcessingActive = isStreaming;
    if (onProcessingStateChange) {
      onProcessingStateChange(isProcessingActive);
    }
  }, [isStreaming, onProcessingStateChange]);

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
      
      // Update local storage to maintain consistency
      if (propsThreadId) {
        localStorage.setItem("lastActiveChatThreadId", propsThreadId);
      }
      debugLog.addEvent("Props Thread Change", `Thread selected via props: ${propsThreadId}`, "info");
    }
  }, [propsThreadId, currentThreadId]);

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
      debugLog.addEvent("Initialization", `Loading stored thread: ${storedThreadId}`, "info");
    } else {
      setInitialLoading(false);
      debugLog.addEvent("Initialization", "No stored thread found, showing empty state", "info");
    }
    
    return () => {
      window.removeEventListener('threadSelected' as any, onThreadChange);
    };
  }, [effectiveUserId, propsThreadId]);

  // Listen for completed responses and reload messages
  useEffect(() => {
    const onResponseReady = (event: CustomEvent) => {
      const { threadId, completed, restored, correlationId } = event.detail;
      
      if (threadId === currentThreadId) {
        console.log(`[SmartChatInterface] Response ready for thread ${currentThreadId}`, {
          completed,
          restored,
          correlationId
        });
        
        // Force reload messages to show latest state, especially for completed/restored responses
        loadThreadMessages(currentThreadId, restored || completed);
        
        // If this was a restoration event, also dispatch to any listening components
        if (restored || completed) {
          debugLog.addEvent("Response Ready", `${restored ? 'Restored' : 'Completed'} response for thread: ${threadId}`, "success");
        }
      }
    };
    
    window.addEventListener('chatResponseReady' as any, onResponseReady);
    return () => {
      window.removeEventListener('chatResponseReady' as any, onResponseReady);
    };
  }, [currentThreadId, debugLog]);

  // Auto-scroll is now handled by the useAutoScroll hook

  const loadThreadMessages = async (threadId: string, forceReload: boolean = false) => {
    if (!threadId || !effectiveUserId) {
      setInitialLoading(false);
      return;
    }
    
    if (loadedThreadRef.current === threadId && !forceReload) {
      debugLog.addEvent("Thread Loading", `Thread ${threadId} already loaded, skipping`, "info");
      return;
    }
    
    if (forceReload) {
      debugLog.addEvent("Thread Loading", `Force reloading thread ${threadId}`, "info");
      loadedThreadRef.current = null; // Reset to ensure proper reload
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
        try {
          const newThreadId = await onCreateNewThread();
          if (newThreadId) {
            threadId = newThreadId;
            if (!propsThreadId) {
              setLocalThreadId(newThreadId);
            }
            debugLog.addEvent("Thread Creation", `New thread created successfully: ${newThreadId}`, "success");
          } else {
            toast({
              title: "Error",
              description: "Failed to create new conversation",
              variant: "destructive"
            });
            debugLog.addEvent("Thread Creation", "Failed to create new thread - null response", "error");
            return;
          }
        } catch (createError: any) {
          debugLog.addEvent("Thread Creation", `Exception creating thread: ${createError.message}`, "error");
          toast({
            title: "Error",
            description: `Failed to create conversation: ${createError.message}`,
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
    
    // Prevent multiple concurrent requests - ONLY useStreamingChat state
    if (isStreaming) {
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
    
    // Force chat area to jump to bottom on send
    window.dispatchEvent(new Event('chat:forceScrollToBottom'));
    
    // NO manual loading states - useStreamingChat handles all states
    
    // Ensure we stay pinned to bottom as processing begins
    window.dispatchEvent(new Event('chat:forceScrollToBottom'));
    try {
      // Update thread processing status to 'processing'
      await updateThreadProcessingStatus(threadId, 'processing');
      
      // Check if this is the first message in the thread
      const isFirstMessage = chatHistory.length === 1; // Only the temp message we just added
      
      // Save the user message with comprehensive error handling and retry logic
      let savedUserMessage: ChatMessage | null = null;
      let saveAttempts = 0;
      const maxSaveAttempts = 3;
      
      while (saveAttempts < maxSaveAttempts && !savedUserMessage) {
        saveAttempts++;
        try {
          const idempotencyKey = `user-${effectiveUserId}-${threadId}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
          debugLog.addEvent("Database", `Saving user message to thread ${threadId} (attempt ${saveAttempts}/${maxSaveAttempts}) with idempotency key: ${idempotencyKey}`, "info");
          
          // Verify thread still exists before attempting save
          const { data: threadCheck, error: threadCheckError } = await supabase
            .from('chat_threads')
            .select('id')
            .eq('id', threadId)
            .eq('user_id', effectiveUserId)
            .maybeSingle();
          
          if (threadCheckError) {
            debugLog.addEvent("Database", `Thread verification failed: ${threadCheckError.message}`, "error");
            throw new Error(`Thread verification failed: ${threadCheckError.message}`);
          }
          
          if (!threadCheck) {
            debugLog.addEvent("Database", `Thread ${threadId} not found or access denied for user ${effectiveUserId}`, "error");
            throw new Error(`Thread not found or access denied`);
          }
          
          debugLog.addEvent("Database", `Thread verification successful, saving message...`, "info");
          
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
          
          if (savedUserMessage) {
            debugLog.addEvent("Database", `User message saved successfully with ID: ${savedUserMessage.id}`, "success");
            break;
          } else {
            throw new Error("saveMessage returned null");
          }
          
        } catch (saveError: any) {
          debugLog.addEvent("Database", `Save attempt ${saveAttempts} failed: ${saveError.message || "Unknown error"}`, "error");
          
          if (saveAttempts >= maxSaveAttempts) {
            // Remove the temporary message from UI on final failure
            setChatHistory(prev => prev.filter(msg => msg.id !== tempUserMessage.id));
            
            toast({
              title: "Failed to save message",
              description: `Could not save your message after ${maxSaveAttempts} attempts. Please try again.`,
              variant: "destructive"
            });
            
            debugLog.addEvent("Database", `All save attempts failed, message not saved`, "error");
            return; // Exit early on complete failure
          }
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * saveAttempts));
        }
      }
      
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
      }
      
      // Initialize processing message placeholder (only created for non-journal queries)
      let processingMessageId: string | null = null;
      
      // Use GPT-based query classification with conversation context
      debugLog.addEvent("Query Classification", `Classifying query: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`, "info");
      // NO manual processing stage updates - useStreamingChat handles all states
      
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
      
      // NO manual processing stage updates - useStreamingChat handles all states
      // NO database processing messages - useStreamingChat handles all processing indicators
      
      // Route ALL queries to chat-with-rag (restored original design)
      debugLog.addEvent("Routing", "Using chat-with-rag for all queries with streaming", "info");
      
      // Start streaming chat for all queries
      await startStreamingChat(
        message,
        threadId,
        effectiveUserId,
        'JOURNAL_SPECIFIC',
        {
          useAllEntries: queryClassification.useAllEntries || false,
          hasPersonalPronouns: message.toLowerCase().includes('i ') || message.toLowerCase().includes('my '),
          hasExplicitTimeReference: /\b(last week|yesterday|this week|last month|today|recently|lately)\b/i.test(message),
          threadMetadata: {}
        }
      );
      
      // Streaming owns the lifecycle - NO manual state clearing needed
      
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
      // NO manual state clearing - useStreamingChat handles all error states
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

    // Prevent deletion if currently processing - ONLY useStreamingChat state
    if (isStreaming) {
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

  // Check if deletion should be disabled - ONLY useStreamingChat state
  const isDeletionDisabled = isStreaming;

  // Thread-scoped loading indicator - ONLY useStreamingChat state
  const showLoadingForThisThread = isStreaming;
  
  // Calculate if any processing is active - ONLY useStreamingChat state
  const isProcessingActive = isStreaming;
  
  // Notify parent of processing state changes
  useEffect(() => {
    onProcessingStateChange?.(isProcessingActive);
  }, [isProcessingActive, onProcessingStateChange]);

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
                // NO manual state clearing - useStreamingChat handles cancellation
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
      
      <div className="chat-content flex-1 overflow-hidden flex flex-col">
        {/* Recovery button for stuck states */}
        <ChatRecoveryButton 
          isStuck={isStuck} 
          onForceRecovery={forceRecovery}
          className="mx-4 mt-4"
        />
        
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
            threadId={currentThreadId}
            onInteractiveOptionClick={handleInteractiveOptionClick}
            isStreaming={isStreaming}
            streamingMessage={
              useThreeDotFallback || dynamicMessages.length === 0
                ? undefined
                : translatedDynamicMessages[currentMessageIndex] || dynamicMessages[currentMessageIndex]
            }
            useThreeDotFallback={useThreeDotFallback}
            showBackendAnimation={showBackendAnimation}
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
