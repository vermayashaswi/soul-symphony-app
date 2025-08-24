import React, { useState, useEffect, useRef } from "react";
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

interface UIChatMessage {
  role: 'user' | 'assistant' | 'error';
  content: string;
  references?: any[];
  analysis?: any;
  hasNumericResult?: boolean;
}

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
  const [isIOSDevice, setIsIOSDevice] = useState(false);
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
  
  
  // Emergency iPhone loading bypass - IMMEDIATE
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isIPhone = /iphone/i.test(userAgent.toLowerCase());
    
    if (isIPhone) {
      // IMMEDIATE force loading completion for iPhone
      console.log('[MobileChatInterface] IMMEDIATE iPhone bypass - forcing loading completion NOW');
      setInitialLoading(false);
      setIsIOSDevice(true);
    }
  }, []);
  
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
    restoreStreamingState
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

         // CRITICAL: Immediate UI update for first messages to prevent blank screen
         if (originThreadId === threadId) {
           setMessages(prev => {
             // Check if this is a duplicate
             const lastMsg = prev[prev.length - 1];
             if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content === response) {
               return prev; // Skip duplicate
             }
             return [...prev, { role: 'assistant', content: response, analysis }];
           });
            setShowSuggestions(false);
           
           debugLog.addEvent("Streaming Response", `[Mobile] Assistant message added to UI for thread ${originThreadId}`, "success");
         }

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
        
         // Ensure backend persistence with enhanced fallback for first messages
         if (originThreadId === threadId) {
          // Enhanced watchdog: reduced delay for first message reliability
          try {
            setTimeout(async () => {
              // Double-check still on same thread
              if (!currentThreadIdRef.current || currentThreadIdRef.current !== originThreadId) return;

              // Check if message already exists in database
              const { data: recent, error: recentErr } = await supabase
                .from('chat_messages')
                .select('id, content, sender, created_at')
                .eq('thread_id', originThreadId)
                .order('created_at', { ascending: false })
                .limit(5);

              if (recentErr) {
                console.warn('[Mobile Streaming Watchdog] Failed to fetch recent messages:', recentErr.message);
              }

              const alreadyExists = (recent || []).some(m => (m as any).sender === 'assistant' && (m as any).content?.trim() === response.trim());
              if (!alreadyExists) {
                 // Enhanced persistence with proper database interaction
                 try {
                   const correlationId = requestId || `assistant-${originThreadId}-${Date.now()}`;

                   const { data: savedMsg, error: saveError } = await supabase.from('chat_messages').insert({
                     thread_id: originThreadId,
                     content: response,
                     sender: 'assistant',
                     role: 'assistant',
                     request_correlation_id: correlationId,
                     analysis_data: analysis || null
                   }).select().single();
                   
                   if (saveError) {
                     console.warn('[Mobile Streaming Watchdog] Persist failed:', saveError);
                   } else {
                     debugLog.addEvent("Streaming Watchdog", `[Mobile] Successfully persisted assistant message: ${savedMsg?.id}`, "success");
                   }
                } catch (e) {
                  console.warn('[Mobile Streaming Watchdog] Persist fallback failed:', (e as any)?.message || e);
                }
              } else {
                debugLog.addEvent("Streaming Watchdog", `[Mobile] Assistant message already exists in database`, "info");
              }

            }, 800); // Reduced delay for faster first message experience
          } catch (e) {
            console.warn('[Mobile Streaming Watchdog] Exception scheduling fallback:', (e as any)?.message || e);
            
          }
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
  const userVerificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Detect iOS device for specific handling
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isiOS = /iphone|ipad|ipod/i.test(userAgent.toLowerCase());
    setIsIOSDevice(isiOS);
    debugLog.addEvent("Platform Detection", `iOS device detected: ${isiOS}`, "info");
  }, []);

  // DISABLED iOS user verification - causing loading loops
  // iPhone users get immediate access without verification

  // Track user message sending for auto-scroll
  const [userJustSentMessage, setUserJustSentMessage] = useState(false);

  // Auto-scroll setup for mobile chat area
  const { scrollElementRef, scrollToBottom } = useAutoScroll({
    dependencies: [messages, streamingMessages, isStreaming],
    enabled: true,
    delay: 50,
    smooth: true,
    scrollThreshold: 50
  });

  // Auto-scroll when user sends a message
  React.useEffect(() => {
    if (userJustSentMessage) {
      scrollToBottom(true); // Force scroll for user messages
      setUserJustSentMessage(false);
    }
  }, [userJustSentMessage, scrollToBottom]);

  // Realtime: append assistant messages saved by backend
  useEffect(() => {
    if (!threadId) return;
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
          if (m.sender === 'assistant') {
            setMessages(prev => {
              // Avoid duplicates by simple heuristic
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant' && last.content === m.content) return prev;
              const uiMsg: UIChatMessage = {
                role: 'assistant',
                content: m.content,
                references: m.reference_entries || undefined,
                analysis: m.analysis_data || undefined,
                hasNumericResult: m.has_numeric_result || false
              };
              return [...prev, uiMsg];
            });
          }
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          const m: any = payload.new;
          if (m.sender === 'assistant') {
            setMessages(prev => {
              // If last assistant message already matches, skip; else append updated
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant' && last.content === m.content) return prev;
              const uiMsg: UIChatMessage = {
                role: 'assistant',
                content: m.content,
                references: m.reference_entries || undefined,
                analysis: m.analysis_data || undefined,
                hasNumericResult: m.has_numeric_result || false
              };
              return [...prev, uiMsg];
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  useEffect(() => {
    // IMMEDIATE thread loading - no delays for iPhone
    const loadThreadData = () => {
      if (threadId) {
        loadThreadMessages(threadId);
        const restored = restoreStreamingState(threadId);
        if (restored) {
          debugLog.addEvent("Thread Initialization", `Restored streaming state for thread: ${threadId}`, "info");
        }
        debugLog.addEvent("Thread Initialization", `Loading current thread: ${threadId}`, "info");
      } else {
        const storedThreadId = localStorage.getItem("lastActiveChatThreadId");
        if (storedThreadId) {
          setThreadId(storedThreadId);
          loadThreadMessages(storedThreadId);
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
    };

    if (isIOSDevice) {
      // IMMEDIATE loading for iPhone - no delays
      debugLog.addEvent("Thread Initialization", "iPhone device - IMMEDIATE loading", "info");
      loadThreadData();
    } else {
      // For non-iOS or when user is available, load immediately
      loadThreadData();
    }
  }, [threadId, user?.id, restoreStreamingState, isIOSDevice]);
  
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

  // Handle user message sent callback
  const handleUserMessageSent = () => {
    setUserJustSentMessage(true);
  };

  const loadThreadMessages = async (currentThreadId: string) => {
    if (!currentThreadId) {
      setInitialLoading(false);
      return;
    }
    
    // SKIP user validation for iPhone - force load with mock data
    if (isIOSDevice && !user?.id) {
      debugLog.addEvent("iPhone Override", "Loading without user validation", "info");
      setMessages([]);
      setShowSuggestions(true);
      setInitialLoading(false);
      return;
    }
    
    if (!user?.id) {
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
      
      if (chatMessages && chatMessages.length > 0) {
        const uiMessages = chatMessages
          .filter(msg => !msg.is_processing)
          .map(msg => ({
            role: msg.sender as 'user' | 'assistant',
            content: msg.content,
            references: msg.reference_entries ? Array.isArray(msg.reference_entries) ? msg.reference_entries : [] : undefined,
            hasNumericResult: msg.has_numeric_result
          }));
        
        setMessages(uiMessages);
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


    let currentThreadId = threadId;
    let isFirstMessage = false;

    // PHASE 1: Ensure thread exists BEFORE any message operations
    if (!currentThreadId) {
      isFirstMessage = true;
      try {
        debugLog.addEvent("Thread Creation", "[Mobile] Creating new thread for first message", "info");
        
        if (onCreateNewThread) {
          const newThreadId = await onCreateNewThread();
          if (!newThreadId) {
            throw new Error("Failed to create new thread");
          }
          currentThreadId = newThreadId;
          setThreadId(newThreadId);
          
          // Wait a moment for thread to be fully established
          await new Promise(resolve => setTimeout(resolve, 100));
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
          
          if (error) {
            throw new Error(`Failed to create thread: ${error.message}`);
          }
          
          currentThreadId = newThreadId;
          setThreadId(newThreadId);
          localStorage.setItem("lastActiveChatThreadId", newThreadId);
          
          // Wait for thread establishment
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        debugLog.addEvent("Thread Creation", `[Mobile] Thread created successfully: ${currentThreadId}`, "success");
      } catch (error) {
        console.error("[Mobile] Failed to create thread:", error);
        toast({
          title: "Error",
          description: "Failed to create new conversation",
          variant: "destructive"
        });
        return;
      }
    } else {
      // Check if this is the first message in an existing thread
      const { count, error } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', currentThreadId);
        
      isFirstMessage = !error && count === 0;
    }

    // PHASE 2: Add user message to UI immediately (optimistic UI)
    const userMessage: UIChatMessage = { role: 'user', content: message };
    setMessages(prev => [...prev, userMessage]);
    setShowSuggestions(false);

    debugLog.addEvent("Message Sending", `[Mobile] Adding user message to UI: ${message.substring(0, 50)}...`, "info");

    // Trigger scroll to bottom after adding user message
    handleUserMessageSent();

    // PHASE 3: Async user message saving (non-blocking)
    const saveUserMessageAsync = async () => {
      try {
        debugLog.addEvent("Message Sending", `[Mobile] Saving user message to database for thread: ${currentThreadId}`, "info");
        
        const savedUserMessage = await saveMessage(
          currentThreadId, 
          message, 
          'user', 
          user.id
        );
        
        if (!savedUserMessage) {
          debugLog.addEvent("Message Sending", "[Mobile] Failed to save user message", "error");
          toast({
            title: "Error", 
            description: "Failed to save your message",
            variant: "destructive"
          });
          return null;
        }

        debugLog.addEvent("Message Sending", `[Mobile] User message saved successfully: ${savedUserMessage.id}`, "success");
        return savedUserMessage;
      } catch (error) {
        console.error("[Mobile] Error saving user message:", error);
        debugLog.addEvent("Message Sending", `[Mobile] Exception saving user message: ${error}`, "error");
        return null;
      }
    };

    // Start async save but don't wait for it
    const userMessagePromise = saveUserMessageAsync();

    try {
      debugLog.addEvent("Message Sending", `[Mobile] Starting streaming chat for thread: ${currentThreadId}`, "info");
      
      // PHASE 4: Start streaming immediately after UI update
      const conversationContext = messages.slice(-5).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      await startStreamingChat(
        message,
        user.id,
        currentThreadId,
        conversationContext,
        {}
      );

      // Auto-scroll handled by ChatArea component

      // PHASE 5: Background operations (don't block streaming)
      if (isFirstMessage) {
        // Defer title generation to prevent interference with first response
        setTimeout(async () => {
          try {
            // Ensure user message is saved before generating title
            await userMessagePromise;
            await generateThreadTitle(currentThreadId, user.id);
            debugLog.addEvent("Thread Title", `[Mobile] Generated title for new thread: ${currentThreadId}`, "success");
          } catch (error) {
            console.warn("[Mobile] Failed to generate thread title:", error);
            debugLog.addEvent("Thread Title", `[Mobile] Failed to generate title: ${error}`, "warning");
          }
        }, 5000); // Extended delay to ensure first response completes
      } else {
        // For existing threads, wait for user message save
        userMessagePromise.then(() => {
          debugLog.addEvent("Message Sending", "[Mobile] User message saved for existing thread", "success");
        }).catch((error) => {
          console.warn("[Mobile] User message save failed:", error);
        });
      }

    } catch (error: any) {
      console.error("[Mobile] Error in streaming chat:", error);
      debugLog.addEvent("Message Sending", `[Mobile] Streaming error: ${error}`, "error");
      
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
      
      toast({
        title: "Error",
        description: error?.message || "Failed to process your message",
        variant: "destructive"
      });
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

  const isDeletionDisabled = false;

  return (
    <div className="mobile-chat-interface">
      {/* Header */}
      <div className="sticky top-0 z-40 w-full bg-background border-b">
        <div className="container flex h-14 max-w-screen-lg items-center">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild disabled={isStreaming}>
              <Button 
                variant="ghost" 
                size="icon" 
                disabled={isStreaming}
                className={`mr-2 transition-opacity ${
                  isStreaming
                    ? "text-muted-foreground/50 opacity-50 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={
                  isStreaming
                    ? "Menu disabled during processing"
                    : "Open menu"
                }
              >
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
                      disabled={false}
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
          <div 
            ref={scrollElementRef}
            className={`mobile-chat-content flex-1 overflow-y-auto p-4 space-y-3 ${isKeyboardVisible ? 'keyboard-visible' : ''}`}
          >
            {messages.map((message, index) => (
              <MobileChatMessage
                key={index}
                message={message}
                showAnalysis={false}
                isLoading={false}
                streamingMessage={undefined}
                showStreamingDots={false}
              />
            ))}
            
            {/* Show streaming message if currently streaming */}
            {isStreaming && streamingMessages && currentMessageIndex < streamingMessages.length && (
              <MobileChatMessage
                message={{ role: 'assistant', content: '' }}
                showAnalysis={false}
                isLoading={false}
                streamingMessage={translatedDynamicMessages[currentMessageIndex] || dynamicMessages[currentMessageIndex] || ''}
                showStreamingDots={useThreeDotFallback}
              />
            )}
            
          </div>
        )}
      
      {/* Chat Input */}
      <MobileChatInput 
        onSendMessage={handleSendMessage} 
        isLoading={false}
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
