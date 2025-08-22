import React, { useState, useEffect, useRef, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Plus, Trash2 } from "lucide-react";
import MobileChatMessage from "./MobileChatMessage";
import MobileChatInput from "./MobileChatInput";

import { supabase } from "@/integrations/supabase/client";
import { ChatThreadList } from "@/components/chat/ChatThreadList";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { v4 as uuidv4 } from "uuid";
import { useDebugLog } from "@/utils/debug/DebugContext";
import { getThreadMessages, saveMessage, updateUserMessageClassification } from "@/services/chat";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { processChatMessage } from "@/services/chatService";
import { MentalHealthInsights } from "@/hooks/use-mental-health-insights";
import { ensureMessageOrder, deduplicateMessages, UIChatMessage } from "@/utils/chat/messageOrdering";

import { updateThreadProcessingStatus, generateThreadTitle } from "@/utils/chat/threadUtils";
import { useUnifiedKeyboard } from "@/hooks/use-unified-keyboard";
import { useEnhancedSwipeGestures } from "@/hooks/use-enhanced-swipe-gestures";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import { threadSafetyManager } from "@/utils/threadSafetyManager";
import ChatErrorBoundary from "../ChatErrorBoundary";
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

// UIChatMessage interface is now imported from messageOrdering utils

interface MobileChatInterfaceProps {
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateNewThread: () => Promise<string | null>;
  userId?: string;
  mentalHealthInsights?: MentalHealthInsights;
}

export default function MobileChatInterface({
  currentThreadId: initialThreadId,
  onSelectThread,
  onCreateNewThread,
  userId,
  mentalHealthInsights,
}: MobileChatInterfaceProps) {
  const [messages, setMessages] = useState<UIChatMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId || null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const debugLog = useDebugLog();
  
  // Track active thread for safety manager
  useEffect(() => {
    threadSafetyManager.setActiveThread(threadId || null);
  }, [threadId]);
  
  // Keep a ref of the latest active thread to guard async UI updates
  const currentThreadIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentThreadIdRef.current = threadId;
  }, [threadId]);
  
  
  const { isKeyboardVisible } = useUnifiedKeyboard();
  
  // Enhanced swipe gesture support for navigation and quick actions
  const chatContainerRef = useEnhancedSwipeGestures({
    onSwipeLeft: () => {
      console.log('[MobileChatInterface] Swipe left - could open thread list');
      // Future: implement thread list navigation
    },
    onSwipeRight: () => {
      console.log('[MobileChatInterface] Swipe right - could close current thread');
      // Future: implement quick navigation
    },
    onSwipeUp: () => {
      console.log('[MobileChatInterface] Swipe up - scroll to top');
      const content = document.querySelector('.mobile-chat-content');
      if (content) {
        content.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    onSwipeDown: () => {
      console.log('[MobileChatInterface] Swipe down - refresh or pull to refresh');
      // Future: implement pull to refresh
    },
    minDistance: 75,
    disabled: false
  });
  
  // Use streaming chat for enhanced UX
  const {
    isStreaming,
    // streamingThreadId - removed as part of thread isolation
    streamingMessages,
    currentUserMessage,
    showBackendAnimation,
    startStreamingChat,
    dynamicMessages,
    translatedDynamicMessages,
    currentMessageIndex,
    useThreeDotFallback,
    queryCategory,
    restoreStreamingState,
    extendStreamingForRealtimeDelivery,
    confirmRealtimeDelivery
   } = useStreamingChat({
      threadId: threadId,
      onFinalResponse: async (response, analysis, originThreadId, requestId) => {
        // Handle final streaming response scoped to its origin thread
        if (!response || !originThreadId || !user?.id) {
          debugLog.addEvent("Streaming Response", "[Mobile] Missing required data for final response", "error");
          console.error("[Mobile] [Streaming] Missing response data:", { response: !!response, originThreadId: !!originThreadId, userId: !!user?.id });
          return;
        }
        
         debugLog.addEvent("Streaming Response", `[Mobile] Final response received for ${originThreadId}: ${response.substring(0, 100)}...`, "success");


         // Remove optimistic UI - let backend persist and realtime handle updates
         setShowSuggestions(false);

         // Update user message with classification data if available
         if (analysis?.classification && requestId) {
           try {
             // Find the most recent user message to update with classification
             const { data: recentUserMessages } = await supabase
               .from('chat_messages')
               .select('id')
               .eq('thread_id', originThreadId)
               .eq('sender', 'user')
               .order('created_at', { ascending: false })
               .limit(1);

             if (recentUserMessages && recentUserMessages.length > 0) {
               await updateUserMessageClassification(
                 recentUserMessages[0].id,
                 analysis.classification,
                 user.id
               );
               debugLog.addEvent("Classification", "Updated user message with classification data", "success");
             }
           } catch (classificationError) {
             console.warn('[Mobile] Failed to update user message classification:', classificationError);
           }
         }
        
        // Backend will persist assistant message; UI updates via realtime
    },
     onError: (error) => {
       toast({
         title: "Error",
         description: error,
         variant: "destructive"
       });
      }
    });
  
  // Helper function to get the latest status message from streaming messages
  const getLatestStatusMessage = useCallback(() => {
    if (!streamingMessages || streamingMessages.length === 0) return undefined;
    
    // Find the latest status_update message
    const statusMessages = streamingMessages.filter(msg => msg.type === 'status_update');
    if (statusMessages.length === 0) return undefined;
    
    const latestStatus = statusMessages[statusMessages.length - 1];
    return latestStatus.statusMessage;
  }, [streamingMessages]);
  
  const suggestionQuestions = [
    {
      text: "What were my top emotions last week?",
      icon: "📊"
    },
    {
      text: "What time of the day do I usually like journaling?", 
      icon: "💡"
    },
    {
      text: "Am i am introvert? Do i like people in general?",
      icon: "🔍"
    },
    {
      text: "What should i particularly do to help my mental health?",
      icon: "🧠"
    },
    {
      text: "Rate my top 3 negative traits out of 100? What do i do to improve them?",
      icon: "🎯"
    }
  ];
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { translate } = useTranslation();
  const loadedThreadRef = useRef<string | null>(null);
  
  // Use unified auto-scroll hook
  const { scrollElementRef, scrollToBottom } = useAutoScroll({
    dependencies: [messages, isStreaming],
    delay: 50,
    scrollThreshold: 100
  });


  // Realtime: append assistant messages saved by backend
  useEffect(() => {
    if (!threadId) return;
    
    console.log('[MobileChatInterface] Setting up realtime subscription for thread:', threadId);
    
    const channel = supabase
      .channel(`mobile-thread-assistant-append-${threadId}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          const m: any = payload.new;
          console.log('[MobileChatInterface] Realtime message received:', { sender: m.sender, contentLength: m.content?.length });
          
          if (m.sender === 'assistant') {
            setMessages(prev => {
              const uiMsg: UIChatMessage = {
                id: m.id,
                role: 'assistant',
                content: m.content,
                references: m.reference_entries || undefined,
                analysis: m.analysis_data || undefined,
                hasNumericResult: m.has_numeric_result || false,
                created_at: m.created_at
              };
              
              console.log('[MobileChatInterface] Adding new assistant message');
              return [...prev, uiMsg];
            });
            
            // Force scroll to bottom when new message arrives
            setTimeout(() => scrollToBottom(), 100);
          }
        }
      )
      .subscribe();
      
    return () => {
      console.log('[MobileChatInterface] Cleaning up realtime subscription for thread:', threadId);
      supabase.removeChannel(channel);
    };
  }, [threadId, scrollToBottom]);

  useEffect(() => {
    if (threadId) {
      loadThreadMessages(threadId);
      // Try to restore streaming state for this thread
      const restored = restoreStreamingState(threadId);
      if (restored) {
        debugLog.addEvent("Thread Initialization", `Restored streaming state for thread: ${threadId}`, "info");
      }
      debugLog.addEvent("Thread Initialization", `Loading current thread: ${threadId}`, "info");
    } else {
      const storedThreadId = localStorage.getItem("lastActiveChatThreadId");
      if (storedThreadId && user?.id) {
        setThreadId(storedThreadId);
        loadThreadMessages(storedThreadId);
        // Try to restore streaming state for stored thread
        const restored = restoreStreamingState(storedThreadId);
        if (restored) {
          debugLog.addEvent("Thread Initialization", `Restored streaming state for stored thread: ${storedThreadId}`, "info");
        }
        debugLog.addEvent("Thread Initialization", `Loading stored thread: ${storedThreadId}`, "info");
      } else {
        setInitialLoading(false);
        debugLog.addEvent("Thread Initialization", "No stored thread found", "info");
      }
    }
  }, [threadId, user?.id, restoreStreamingState]);
  
  useEffect(() => {
    const onThreadChange = (event: CustomEvent) => {
      if (event.detail.threadId) {
        setThreadId(event.detail.threadId);
        loadThreadMessages(event.detail.threadId);
        debugLog.addEvent("Thread Change", `Thread selected: ${event.detail.threadId}`, "info");
      }
    };
    
    window.addEventListener('threadSelected' as any, onThreadChange);
    
    return () => {
      window.removeEventListener('threadSelected' as any, onThreadChange);
    };
  }, []);

  // Auto-scroll is now handled by the useAutoScroll hook

  const loadThreadMessages = async (currentThreadId: string) => {
    if (!currentThreadId || !user?.id) {
      setInitialLoading(false);
      return;
    }
    
    if (loadedThreadRef.current === currentThreadId) {
      debugLog.addEvent("Thread Loading", `Thread ${currentThreadId} already loaded, skipping`, "info");
      return;
    }
    
    setInitialLoading(true);
    debugLog.addEvent("Thread Loading", `[Mobile] Loading messages for thread ${currentThreadId}`, "info");
    
    try {
      const { data: threadData, error: threadError } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('id', currentThreadId)
        .eq('user_id', user.id)
        .single();
        
      if (threadError || !threadData) {
        debugLog.addEvent("Thread Loading", `[Mobile] Thread not found or doesn't belong to user: ${threadError?.message || "Unknown error"}`, "error");
        setMessages([]);
        setShowSuggestions(true);
        setInitialLoading(false);
        return;
      }
      
      const chatMessages = await getThreadMessages(currentThreadId, user.id);
      console.log(`[MobileChatInterface] Loaded ${chatMessages?.length || 0} messages for thread ${currentThreadId}`);
      
      if (chatMessages && chatMessages.length > 0) {
        const uiMessages: UIChatMessage[] = chatMessages
          .map(msg => ({
            id: msg.id,
            role: msg.sender as 'user' | 'assistant',
            content: msg.content,
            references: msg.reference_entries ? Array.isArray(msg.reference_entries) ? msg.reference_entries : [] : undefined,
            hasNumericResult: msg.has_numeric_result,
            created_at: msg.created_at
          }));
        
        // Ensure proper ordering and remove duplicates
        const orderedMessages = deduplicateMessages(ensureMessageOrder(uiMessages));
        
        console.log(`[MobileChatInterface] Displaying ${orderedMessages.length} messages`);
        setMessages(orderedMessages);
        setShowSuggestions(false);
        loadedThreadRef.current = currentThreadId;
      } else {
        setMessages([]);
        setShowSuggestions(true);
      }
    } catch (error) {
      debugLog.addEvent("Thread Loading", `[Mobile] Error loading messages: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
      toast({
        title: "Error loading messages",
        description: "Could not load conversation history.",
        variant: "destructive"
      });
      setMessages([]);
      setShowSuggestions(true);
    } finally {
      setInitialLoading(false);
    }
  };

  // Clear any existing intervals when component unmounts
  useEffect(() => {
    return () => {
      if (pendingMessageTracker.pollingInterval) {
        clearInterval(pendingMessageTracker.pollingInterval);
      }
    };
  }, [threadId]);

  // Backup polling mechanism for message persistence checking
  const startMessagePersistenceTracking = useCallback((expectedMessageType: 'assistant' = 'assistant') => {
    console.log(`[MobileChatInterface] Starting message persistence tracking for ${expectedMessageType} message`);
    
    // Clear any existing tracking
    if (pendingMessageTracker.pollingInterval) {
      clearInterval(pendingMessageTracker.pollingInterval);
    }

    const startTime = Date.now();
    const pollingInterval = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      
      // Stop polling after 15 seconds
      if (elapsed > 15000) {
        console.log(`[MobileChatInterface] Message persistence tracking timeout`);
        clearInterval(pollingInterval);
        setPendingMessageTracker({
          messageId: null,
          expectedAt: 0,
          pollingInterval: null
        });
        return;
      }

      try {
        // Check for new assistant messages
        const { data: recentMessages } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('thread_id', threadId!)
          .eq('sender', expectedMessageType)
          .order('created_at', { ascending: false })
          .limit(1);

        if (recentMessages && recentMessages.length > 0) {
          const latestMessage = recentMessages[0];
          const messageAge = Date.now() - new Date(latestMessage.created_at).getTime();
          
          // If message is newer than our tracking start and not in UI yet
          if (messageAge < elapsed + 2000) {
            console.log(`[MobileChatInterface] Found persisted message via polling: ${latestMessage.id}`);
            
            // Check if message is already in UI
            setMessages(prevMessages => {
              const exists = prevMessages.some(msg => msg.id === latestMessage.id);
              if (!exists) {
                console.log(`[MobileChatInterface] Adding persisted message to UI: ${latestMessage.id}`);
                
                const uiMessage = {
                  id: latestMessage.id,
                  role: latestMessage.sender as 'user' | 'assistant' | 'error',
                  content: latestMessage.content,
                  references: latestMessage.reference_entries ? Array.isArray(latestMessage.reference_entries) ? latestMessage.reference_entries : [] : undefined,
                  hasNumericResult: latestMessage.has_numeric_result,
                  created_at: latestMessage.created_at,
                  analysis: latestMessage.analysis_data
                };
                
                // Force scroll to bottom
                setTimeout(() => scrollToBottom(), 100);
                
                return insertMessageInOrder(prevMessages, uiMessage);
              }
              return prevMessages;
            });

            // Clear tracking
            clearInterval(pollingInterval);
            setPendingMessageTracker({
              messageId: null,
              expectedAt: 0,
              pollingInterval: null
            });
          }
        }
      } catch (error) {
        console.error('[MobileChatInterface] Error in message persistence polling:', error);
      }
    }, 2000); // Poll every 2 seconds

    setPendingMessageTracker({
      messageId: null,
      expectedAt: startTime,
      pollingInterval: pollingInterval
    });
  }, [threadId, scrollToBottom]);

  // Real-time subscription for message updates
  useEffect(() => {
    if (!threadId || !user?.id) return;

    console.log(`[MobileChatInterface] Setting up real-time subscription for thread: ${threadId}`);
    
    const handleRealtimeInsert = (payload: any) => {
      const newMessage = payload.new;
      console.log(`[MobileChatInterface] Real-time INSERT: ${newMessage.id} - ${newMessage.sender}`);
      
      // Clear persistence tracking and confirm realtime delivery if this is an assistant message
      if (newMessage.sender === 'assistant') {
        console.log(`[MobileChatInterface] Received assistant message, confirming realtime delivery`);
        
        // Clear polling tracker
        if (pendingMessageTracker.pollingInterval) {
          clearInterval(pendingMessageTracker.pollingInterval);
          setPendingMessageTracker({
            messageId: null,
            expectedAt: 0,
            pollingInterval: null
          });
        }
        
        // Confirm realtime delivery to useStreamingChat
        if (confirmRealtimeDelivery && threadId) {
          confirmRealtimeDelivery();
        }
      }
      
      setMessages(prevMessages => {
        const uiMessage: UIChatMessage = {
          id: newMessage.id,
          role: newMessage.sender as 'user' | 'assistant' | 'error',
          content: newMessage.content,
          references: newMessage.reference_entries ? Array.isArray(newMessage.reference_entries) ? newMessage.reference_entries : [] : undefined,
          hasNumericResult: newMessage.has_numeric_result,
          created_at: newMessage.created_at,
          analysis: newMessage.analysis_data
        };
        
        // Force scroll to bottom for assistant messages
        if (newMessage.sender === 'assistant') {
          setTimeout(() => scrollToBottom(), 100);
        }
        
        return insertMessageInOrder(prevMessages, uiMessage);
      });
    };

    const handleRealtimeUpdate = (payload: any) => {
      const updatedMessage = payload.new;
      console.log(`[MobileChatInterface] Real-time UPDATE: ${updatedMessage.id}`);
      
      setMessages(prevMessages => {
        return prevMessages.map(msg => 
          msg.id === updatedMessage.id 
            ? {
                ...msg,
                content: updatedMessage.content,
                references: updatedMessage.reference_entries ? Array.isArray(updatedMessage.reference_entries) ? updatedMessage.reference_entries : [] : undefined,
                hasNumericResult: updatedMessage.has_numeric_result,
                analysis: updatedMessage.analysis_data
              }
            : msg
        );
      });
    };

    const channel = supabase
      .channel(`chat_messages_${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`
        },
        handleRealtimeInsert
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`
        },
        handleRealtimeUpdate
      )
      .subscribe((status) => {
        console.log(`[MobileChatInterface] Subscription status: ${status}`);
      });

    return () => {
      console.log(`[MobileChatInterface] Cleaning up real-time subscription for thread: ${threadId}`);
      supabase.removeChannel(channel);
    };
  }, [threadId, user?.id]);

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

    if (isStreaming) {
      toast({
        title: "Please wait",
        description: "Another request is currently being processed.",
        variant: "default"
      });
      return;
    }

    let currentThreadId = threadId;
    let isFirstMessage = false;
    
    if (!currentThreadId) {
      try {
        if (onCreateNewThread) {
          const newThreadId = await onCreateNewThread();
          if (!newThreadId) {
            throw new Error("Failed to create new thread");
          }
          currentThreadId = newThreadId;
        } else {
          const newThreadId = uuidv4();
          const { error } = await supabase
            .from('chat_threads')
            .insert({
              id: newThreadId,
              user_id: user.id,
              title: "New Conversation",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (error) throw error;
          
          currentThreadId = newThreadId;
          setThreadId(newThreadId);
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to create new conversation",
          variant: "destructive"
        });
        return;
      }
    } else {
      const { count, error } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', currentThreadId);
        
      isFirstMessage = !error && count === 0;
    }
    
    const userMessage: UIChatMessage = {
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
      id: `user-${Date.now()}`
    };
    setMessages(prev => insertMessageInOrder(prev, userMessage));
    // Force scroll to bottom on send so user sees streaming/processing
    scrollToBottom(true);
    
    // Ensure we remain pinned to bottom as processing begins
    scrollToBottom(true);
    
    try {
      await updateThreadProcessingStatus(currentThreadId, 'processing');
      
      const savedUserMessage = await saveMessage(currentThreadId, message, 'user', user.id);
      
      // Generate title for the first message in a thread
      if (isFirstMessage && savedUserMessage) {
        try {
          const generatedTitle = await generateThreadTitle(currentThreadId, user.id);
          if (generatedTitle) {
            // Dispatch event to update sidebar
            window.dispatchEvent(
              new CustomEvent('threadTitleUpdated', {
                detail: { threadId: currentThreadId, title: generatedTitle }
              })
            );
          }
        } catch (titleError) {
          console.warn('Failed to generate thread title:', titleError);
        }
      }
      
      window.dispatchEvent(
        new CustomEvent('messageCreated', { 
          detail: { 
            threadId: currentThreadId, 
            isFirstMessage,
            content: message
          } 
        })
      );
      
      // Use streaming chat for enhanced UX
      const conversationContext = messages.slice(-5).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Start message persistence tracking
      startMessagePersistenceTracking('assistant');
      
      // Start streaming chat with conversation context
      await startStreamingChat(
        message,
        user.id,
        conversationContext,
        {},
        undefined, // onTypingAnimation
        currentThreadId
      );
      
      await updateThreadProcessingStatus(currentThreadId, 'idle');
    } catch (error: any) {
      if (currentThreadId) {
        await updateThreadProcessingStatus(currentThreadId, 'failed');
      }
      
      // Check if this error occurred during streaming - if so, don't clear optimistic UI
      const isStreamingError = streamingMessages && streamingMessages.length > 0;
      
      if (!isStreamingError) {
        const errorMessageContent = "I'm having trouble processing your request. Please try again later. " + 
                   (error?.message ? `Error: ${error.message}` : "");
        
        if (currentThreadId === currentThreadIdRef.current) {
          setMessages(prev => [
            ...prev, 
            { 
              role: 'assistant', 
              content: errorMessageContent
            }
          ]);
        }
      } else {
        // During streaming, log error but don't interfere with optimistic UI
        console.error('[MobileChatInterface] Streaming error (preserving UI):', error);
        
        // Check if message was actually persisted despite the error
        setTimeout(async () => {
          try {
            const { data: recentMessages } = await supabase
              .from('chat_messages')
              .select('*')
              .eq('thread_id', currentThreadId!)
              .order('created_at', { ascending: false })
              .limit(1);
            
              if (recentMessages && recentMessages.length > 0 && recentMessages[0].sender === 'assistant') {
                console.log('[MobileChatInterface] Message was persisted, triggering UI sync');
                // Show subtle success toast instead of "messages synced"
                toast({
                  title: "Message received",
                  description: "",
                  duration: 1500,
                  variant: "default"
                });
                // Trigger realtime sync by refreshing subscription
                await loadThreadMessages(currentThreadId!);
              }
          } catch (persistenceCheckError) {
            console.error('[MobileChatInterface] Error checking message persistence:', persistenceCheckError);
          }
        }, 2000);
      }
    } finally {
      // Loading state is now managed by useStreamingChat
    }
  };

  const handleSelectThread = async (selectedThreadId: string) => {
    if (!selectedThreadId || !user?.id) {
      console.error('[MobileChat] Cannot select thread: invalid threadId or user not authenticated');
      toast({
        title: "Error",
        description: "Failed to select conversation",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('[MobileChat] Selecting thread:', selectedThreadId);
      
      // Set loading state before starting the process
      setInitialLoading(true);
      
      // Verify thread exists and belongs to user
      const { data: threadData, error: threadError } = await supabase
        .from('chat_threads')
        .select('id, title')
        .eq('id', selectedThreadId)
        .eq('user_id', user.id)
        .single();
        
      if (threadError || !threadData) {
        console.error('[MobileChat] Thread not found or access denied:', threadError);
        toast({
          title: "Error",
          description: "Cannot access this conversation",
          variant: "destructive"
        });
        setInitialLoading(false);
        return;
      }

      // Close sheet immediately after verification
      setSheetOpen(false);
      
      // Update thread state and load messages
      setThreadId(selectedThreadId);
      localStorage.setItem("lastActiveChatThreadId", selectedThreadId);
      
      if (onSelectThread) {
        onSelectThread(selectedThreadId);
      }
      
      // Load messages for the selected thread
      await loadThreadMessages(selectedThreadId);
      
      console.log('[MobileChat] Successfully selected thread:', selectedThreadId);
      
    } catch (error) {
      console.error('[MobileChat] Error selecting thread:', error);
      toast({
        title: "Error", 
        description: "Failed to select conversation",
        variant: "destructive"
      });
      setInitialLoading(false);
    }
  };

  const handleDeleteCurrentThread = async () => {
    if (!threadId || !user?.id) {
      console.error('[MobileChat] Cannot delete: no active thread or user not authenticated');
      toast({
        title: "Error",
        description: "No active conversation to delete",
        variant: "destructive"
      });
      return;
    }

    if (isStreaming) {
      console.log('[MobileChat] Cannot delete thread while processing');
      toast({
        title: "Cannot delete conversation",
        description: "Please wait for the current request to complete before deleting this conversation.",
        variant: "destructive"
      });
      setShowDeleteDialog(false);
      return;
    }

    try {
      console.log('[MobileChat] Deleting thread:', threadId);
      
      // Delete messages first (foreign key relationship)
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('thread_id', threadId);
        
      if (messagesError) {
        console.error('[MobileChat] Error deleting messages:', messagesError);
        throw messagesError;
      }
      
      // Delete the thread
      const { error: threadError } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', threadId)
        .eq('user_id', user.id); // Extra safety check
        
      if (threadError) {
        console.error('[MobileChat] Error deleting thread:', threadError);
        throw threadError;
      }
      
      console.log('[MobileChat] Successfully deleted thread:', threadId);
      
      // Clear current state
      setMessages([]);
      setShowSuggestions(true);
      loadedThreadRef.current = null;
      localStorage.removeItem("lastActiveChatThreadId");

      // Try to find another thread to switch to
      const { data: threads, error: threadsError } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (threadsError) {
        console.error('[MobileChat] Error fetching remaining threads:', threadsError);
      }

      if (threads && threads.length > 0) {
        // Switch to the most recent remaining thread
        console.log('[MobileChat] Switching to thread:', threads[0].id);
        setThreadId(threads[0].id);
        localStorage.setItem("lastActiveChatThreadId", threads[0].id);
        await loadThreadMessages(threads[0].id);
      } else {
        // No threads left, create a new one
        console.log('[MobileChat] No remaining threads, creating new one');
        try {
          const newThreadId = await onCreateNewThread();
          if (newThreadId) {
            setThreadId(newThreadId);
            localStorage.setItem("lastActiveChatThreadId", newThreadId);
          } else {
            // Fallback if creation fails
            setThreadId(null);
          }
        } catch (createError) {
          console.error('[MobileChat] Error creating new thread after deletion:', createError);
          setThreadId(null);
        }
      }

      toast({
        title: "Success",
        description: "Conversation deleted successfully",
      });
      
      setShowDeleteDialog(false);
      
    } catch (error) {
      console.error('[MobileChat] Error deleting conversation:', error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
      setShowDeleteDialog(false);
    }
  };

  const isDeletionDisabled = isStreaming;

  return (
    <div className="mobile-chat-interface">
      {/* Header */}
      <div className="sticky top-0 z-40 w-full bg-background border-b">
        <div className="container flex h-14 max-w-screen-lg items-center">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="h-5 w-5" />
                <span className="sr-only">
                  <TranslatableText text="Toggle Menu" />
                </span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[80%] sm:w-[350px]">
              <SheetHeader className="flex flex-row items-center justify-between py-2">
                <Button
                  className="flex items-center gap-1"
                  onClick={async () => {
                    try {
                      console.log('[MobileChat] New Chat button clicked');
                      
                      if (!user?.id) {
                        toast({
                          title: "Authentication required",
                          description: "Please sign in to create a new conversation",
                          variant: "destructive"
                        });
                        return;
                      }

                      setSheetOpen(false);
                      setInitialLoading(true);
                      
                      const newThreadId = await onCreateNewThread();
                      if (newThreadId) {
                        console.log('[MobileChat] New thread created:', newThreadId);
                        setThreadId(newThreadId);
                        setMessages([]);
                        setShowSuggestions(true);
                        loadedThreadRef.current = null;
                        localStorage.setItem("lastActiveChatThreadId", newThreadId);
                        
                        toast({
                          title: "Success",
                          description: "New conversation started",
                        });
                      } else {
                        console.error('[MobileChat] Failed to create new thread');
                        toast({
                          title: "Error",
                          description: "Failed to create new conversation",
                          variant: "destructive"
                        });
                      }
                    } catch (error) {
                      console.error('[MobileChat] Error in new chat creation:', error);
                      toast({
                        title: "Error",
                        description: "Failed to create new conversation",
                        variant: "destructive"
                      });
                    } finally {
                      setInitialLoading(false);
                    }
                  }}
                  size="sm"
                  disabled={initialLoading}
                >
                  <Plus className="h-4 w-4" />
                  <TranslatableText text="New Chat" />
                </Button>
              </SheetHeader>
              
              <div className="mt-2 h-[calc(100vh-80px)]">
                <ChatThreadList
                  activeThreadId={threadId}
                  onSelectThread={handleSelectThread}
                  showHeader={false}
                />
              </div>
            </SheetContent>
          </Sheet>
          
          <div className="flex-1 flex justify-center">
            <h1 className="text-lg font-semibold">
              <TranslatableText text="Ruh" />
            </h1>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className={`ml-2 ${
              isDeletionDisabled 
                ? 'text-muted-foreground/50 cursor-not-allowed' 
                : 'text-muted-foreground hover:text-destructive'
            }`}
            onClick={() => !isDeletionDisabled && setShowDeleteDialog(true)}
            disabled={isDeletionDisabled}
          >
            <Trash2 className="h-5 w-5" />
            <span className="sr-only">
              <TranslatableText text={isDeletionDisabled ? "Cannot delete while processing" : "Delete Chat"} />
            </span>
          </Button>
        </div>
      </div>
      
      {/* Chat Content */}
      <div 
        className={`mobile-chat-content ${isKeyboardVisible ? 'keyboard-visible' : ''}`} 
        ref={scrollElementRef}
      >
        {initialLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="ml-2 text-muted-foreground">
              <TranslatableText text="Loading conversation..." />
            </span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col justify-start h-full mt-6 pt-4">
            <div className="text-center px-4">
              <h3 className="text-xl font-medium mb-2">
                <TranslatableText text="How can I help you?" />
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                <TranslatableText text="Ask me anything about your mental well-being and journal entries" />
              </p>
              
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col gap-2 mx-auto max-w-[280px]"
                >
                  {suggestionQuestions.map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="px-3 py-2 h-auto justify-start text-sm text-left bg-muted/50 hover:bg-muted w-full"
                      onClick={() => handleSendMessage(question.text)}
                      disabled={isStreaming}
                    >
                      <div className="flex items-start w-full">
                        <span className="mr-2">{question.icon}</span>
                        <span className="flex-grow break-words whitespace-normal">
                          <TranslatableText text={question.text} />
                        </span>
                      </div>
                    </Button>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <ChatMessageErrorBoundary key={`msg-${message.id || index}`}>
                <MobileChatMessage 
                  message={message} 
                  showAnalysis={false}
                />
              </ChatMessageErrorBoundary>
            ))}
            
            {/* Show streaming status or basic loading */}
            {isStreaming ? (
              <ChatErrorBoundary>
                <MobileChatMessage 
                  message={{ role: 'assistant', content: '' }}
                  streamingMessage={
                    useThreeDotFallback 
                      ? undefined // Show only three-dot animation
                      : getLatestStatusMessage() || translatedDynamicMessages[currentMessageIndex] || dynamicMessages[currentMessageIndex] // Use pre-translated message
                  }
                  showStreamingDots={true}
                />
              </ChatErrorBoundary>
            ) : null}
            
            {/* Spacer for auto-scroll */}
            <div className="pb-5" />
          </div>
        )}
      </div>
      
      {/* Chat Input */}
      <MobileChatInput 
        onSendMessage={handleSendMessage} 
        isLoading={isStreaming}
        userId={userId || user?.id}
      />
      
      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <TranslatableText text="Delete this conversation?" />
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isDeletionDisabled ? (
                <TranslatableText text="Cannot delete conversation while the chatbot is processing a request. Please wait for the current request to complete." />
              ) : (
                <TranslatableText text="This will permanently delete this conversation and all its messages. This action cannot be undone." />
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <TranslatableText text="Cancel" />
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCurrentThread}
              disabled={isDeletionDisabled}
              className={`${
                isDeletionDisabled 
                  ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                  : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
              }`}
            >
              <TranslatableText text="Delete" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
