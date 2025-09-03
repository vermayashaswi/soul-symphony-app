import React, { useState, useEffect, useRef, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Plus, Trash2, RefreshCw } from "lucide-react";
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
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { updateThreadProcessingStatus, generateThreadTitle } from "@/utils/chat/threadUtils";
import { useUnifiedKeyboard } from "@/hooks/use-unified-keyboard";
import { useDualModeGestureDetection } from "@/hooks/use-dual-mode-gesture-detection";
import { useWebViewGestureOptimizer } from "@/hooks/use-webview-gesture-optimizer";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import { threadSafetyManager } from "@/utils/threadSafetyManager";
import ChatErrorBoundary from "../ChatErrorBoundary";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { useMobileChatEnhancements } from "@/hooks/use-mobile-chat-enhancements";
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
  onProcessingStateChange?: (isProcessing: boolean) => void;
}

export default function MobileChatInterface({
  currentThreadId: initialThreadId,
  onSelectThread,
  onCreateNewThread,
  userId,
  mentalHealthInsights,
  onProcessingStateChange,
}: MobileChatInterfaceProps) {
  const [messages, setMessages] = useState<UIChatMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId || null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [stateLocked, setStateLocked] = useState(false);
  const debugLog = useDebugLog();

  // CRITICAL: State locking system to prevent overrides during completion
  const lockState = useCallback((reason: string) => {
    console.log('[MobileChatInterface] Locking state:', reason);
    setStateLocked(true);
    // Auto-unlock after 2 seconds to prevent permanent locks
    setTimeout(() => {
      setStateLocked(false);
      console.log('[MobileChatInterface] State auto-unlocked');
    }, 2000);
  }, []);

  // CRITICAL: Listen for chat response completion events FIRST - now with state locking
  useEffect(() => {
    const handleChatResponseReady = (event: CustomEvent) => {
      const { threadId: completedThreadId } = event.detail || {};
      
      console.log('[MobileChatInterface] Chat response ready event received for thread:', completedThreadId, 'current:', threadId);
      
      if (completedThreadId && completedThreadId === threadId) {
        console.log('[MobileChatInterface] Stopping streaming and reloading messages for completed thread:', completedThreadId);
        stopStreaming(); // Clear streaming state immediately
        lockState('Chat completion detected');
        // Reload messages to show the completed response immediately
        loadThreadMessages(completedThreadId);
      }
    };

    window.addEventListener('chatResponseReady', handleChatResponseReady as EventListener);
    
    return () => {
      window.removeEventListener('chatResponseReady', handleChatResponseReady as EventListener);
    };
  }, [threadId, lockState]); // Dependencies include threadId for proper event filtering
  
  // Track active thread for safety manager
  useEffect(() => {
    threadSafetyManager.setActiveThread(threadId || null);
  }, [threadId]);
  
  // Keep a ref of the latest active thread to guard async UI updates
  const currentThreadIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentThreadIdRef.current = threadId;
  }, [threadId]);
  
  // Use realtime hook ONLY for message subscriptions (NO processing states)
  const {
    // Only used for message subscription management
  } = useChatRealtime(threadId);
  
  const { isKeyboardVisible } = useUnifiedKeyboard();
  
  // Initialize WebView gesture optimizations
  const { isOptimized, deviceInfo, platform: detectedPlatform } = useWebViewGestureOptimizer();
  
  // Enhanced dual-mode swipe gesture support with Capacitor optimization
  const gestureDetection = useDualModeGestureDetection({
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
    minDistance: 70, // Fixed distance for WebView
    disabled: false,
    debugMode: false
  });
  
  const chatContainerRef = gestureDetection.ref;
  
  // Use streaming chat for enhanced UX
   const {
    isStreaming,
    // streamingThreadId - removed as part of thread isolation
    streamingMessages,
    currentUserMessage,
    showBackendAnimation,
    startStreamingChat,
    stopStreaming,
    dynamicMessages,
    translatedDynamicMessages,
    currentMessageIndex,
    useThreeDotFallback,
    queryCategory,
    resumeStreamingState
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
            // NO manual state clearing - useStreamingChat handles it
           
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

              // NO manual state clearing - useStreamingChat handles it
            }, 800); // Reduced delay for faster first message experience
          } catch (e) {
            console.warn('[Mobile Streaming Watchdog] Exception scheduling fallback:', (e as any)?.message || e);
            // NO manual state clearing - useStreamingChat handles it
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

  // Enhanced mobile chat functionality for stuck state recovery
  const { triggerManualRefresh, canManualRefresh, isMobile, platform } = useMobileChatEnhancements({
    threadId,
    onCompletionDetected: (data) => {
      console.log('[MobileChatInterface] Chat completion detected via mobile enhancements:', data);
      
      // Force immediate UI state clear for mobile browsers
      if (data.threadId === threadId) {
        // Clear any lingering streaming indicators in the UI
        const streamingElements = document.querySelectorAll('[data-streaming="true"]');
        streamingElements.forEach(element => {
          element.setAttribute('data-streaming', 'false');
        });
        
        // Force message reload with UI sync
        setTimeout(() => {
          loadThreadMessages(data.threadId);
        }, 100);
      }
    },
    onStateUpdated: (data) => {
      console.log('[MobileChatInterface] Chat state updated via mobile enhancements:', data);
      
      // Enhanced completion handling with immediate UI synchronization
      if (data.completed && data.threadId === threadId) {
        // Force clear streaming indicators
        const avatarElements = document.querySelectorAll('[data-chat-avatar-streaming]');
        avatarElements.forEach(element => {
          element.removeAttribute('data-chat-avatar-streaming');
        });
        
        // Force message reload and UI refresh
        loadThreadMessages(data.threadId);
        
        // Additional mobile browser specific refresh
        if (platform === 'android' || platform === 'ios') {
          setTimeout(() => {
            window.dispatchEvent(new Event('chat:forceScrollToBottom'));
          }, 200);
        }
      }
    }
  });
  
  // Detect iOS device for specific handling
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isiOS = /iphone|ipad|ipod/i.test(userAgent.toLowerCase());
    setIsIOSDevice(isiOS);
    debugLog.addEvent("Platform Detection", `iOS device detected: ${isiOS}`, "info");
  }, []);

  // iOS-specific user verification with retry logic
  useEffect(() => {
    if (!isIOSDevice || user) return;

    let retryCount = 0;
    const maxRetries = 5;
    const retryDelay = 1000;

    const verifyUser = () => {
      if (user) {
        debugLog.addEvent("iOS User Verification", "User verified successfully", "success");
        return;
      }

      retryCount++;
      if (retryCount <= maxRetries) {
        debugLog.addEvent("iOS User Verification", `Retry ${retryCount}/${maxRetries} - User not yet available`, "warning");
        userVerificationTimeoutRef.current = setTimeout(verifyUser, retryDelay);
      } else {
        debugLog.addEvent("iOS User Verification", "Max retries reached - user verification failed", "error");
        toast({
          title: "Authentication Issue",
          description: "Please refresh the page if the chat doesn't load.",
          variant: "destructive"
        });
      }
    };

    // Start verification after a brief delay for iOS session stabilization
    userVerificationTimeoutRef.current = setTimeout(verifyUser, 2000);

    return () => {
      if (userVerificationTimeoutRef.current) {
        clearTimeout(userVerificationTimeoutRef.current);
      }
    };
  }, [isIOSDevice, user]);

  // Use unified auto-scroll hook - ONLY useStreamingChat dependencies
  const { scrollElementRef, scrollToBottom } = useAutoScroll({
    dependencies: [messages, isStreaming],
    delay: 50,
    scrollThreshold: 100
  });

  // Force scroll event listener (matching ChatArea.tsx behavior)
  useEffect(() => {
    const handleForceScrollToBottom = () => {
      scrollToBottom(true);
    };

    window.addEventListener('chat:forceScrollToBottom', handleForceScrollToBottom);
    
    return () => {
      window.removeEventListener('chat:forceScrollToBottom', handleForceScrollToBottom);
    };
  }, [scrollToBottom]);

  // Mobile-specific navigation safety net - triggers immediately on page visibility
  useEffect(() => {
    const handlePageVisibility = async () => {
      if (!document.hidden && threadId) {
        console.log('[MobileChatInterface] Page became visible, checking for completion:', threadId);
        
        // Quick completion check for mobile navigation scenarios
        try {
          const { data: recentMessages } = await supabase
            .from('chat_messages')
            .select('id, created_at, content, sender')
            .eq('thread_id', threadId)
            .eq('sender', 'assistant')
            .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
            .order('created_at', { ascending: false })
            .limit(1);

          if (recentMessages && recentMessages.length > 0) {
            const message = recentMessages[0];
            if (message.content.length > 15 && !message.content.includes('...')) {
              console.log('[MobileChatInterface] Found recent completion, triggering reload');
              window.dispatchEvent(new CustomEvent('chatResponseReady', { 
                detail: { threadId } 
              }));
            }
          }
        } catch (error) {
          console.warn('[MobileChatInterface] Error in visibility check:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handlePageVisibility);
    
    return () => {
      document.removeEventListener('visibilitychange', handlePageVisibility);
    };
  }, [threadId]);

  // Notify parent of processing state changes - ONLY useStreamingChat states
  useEffect(() => {
    const isProcessingActive = isStreaming;
    if (onProcessingStateChange) {
      onProcessingStateChange(isProcessingActive);
    }
  }, [isStreaming, onProcessingStateChange]);

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
    // iOS-specific delay before thread loading
    const loadWithIOSDelay = () => {
      if (threadId) {
        loadThreadMessages(threadId);
        debugLog.addEvent("Thread Initialization", `Loading current thread: ${threadId}`, "info");
      } else {
        const storedThreadId = localStorage.getItem("lastActiveChatThreadId");
        if (storedThreadId && user?.id) {
          setThreadId(storedThreadId);
          loadThreadMessages(storedThreadId);
          debugLog.addEvent("Thread Initialization", `Loading stored thread: ${storedThreadId}`, "info");
        } else {
          setInitialLoading(false);
          debugLog.addEvent("Thread Initialization", "No stored thread found", "info");
        }
      }
    };

    if (isIOSDevice && !user) {
      // For iOS, wait longer for user authentication to stabilize
      debugLog.addEvent("Thread Initialization", "iOS device - waiting for user authentication", "info");
      const timeout = setTimeout(loadWithIOSDelay, 3000);
      return () => clearTimeout(timeout);
    } else {
      // For non-iOS or when user is available, load immediately
      loadWithIOSDelay();
    }
  }, [threadId, user?.id,  isIOSDevice]);
  
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
      // iOS-specific timeout for loader - prevent infinite loading
      if (isIOSDevice) {
        setTimeout(() => {
          setInitialLoading(false);
          debugLog.addEvent("iOS Loading Timeout", "Loader timeout triggered for iOS", "warning");
        }, 8000);
      } else {
        setInitialLoading(false);
      }
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
        
        // CHECK FOR COMPLETION FIRST - before resuming any streaming state
        const hasCompletedResponse = chatMessages.some(msg => 
          msg.sender === 'assistant' && !msg.is_processing
        );
        
        if (hasCompletedResponse) {
          // Don't resume streaming - just show completed messages
          debugLog.addEvent("Thread Loading", `Found completed response for thread: ${currentThreadId}`, "info");
          
          // Clear any existing streaming state
          if (isStreaming) {
            stopStreaming();
            debugLog.addEvent("Thread Loading", `Cleared streaming state - found completed response`, "info");
          }
        } else {
          // Still processing - check if we should resume streaming state
          const streamingResumed = resumeStreamingState(currentThreadId);
          if (streamingResumed) {
            debugLog.addEvent("Thread Loading", `Resumed streaming state for thread: ${currentThreadId}`, "info");
            
            // Start periodic completion check while streaming
            const checkInterval = setInterval(async () => {
              try {
                const updatedMessages = await getThreadMessages(currentThreadId, user.id);
                const hasCompleted = updatedMessages?.some(msg => 
                  msg.sender === 'assistant' && !msg.is_processing
                );
                
                if (hasCompleted) {
                  clearInterval(checkInterval);
                  stopStreaming();
                  // Reload messages to show the completed response
                  const finalMessages = updatedMessages
                    .filter(msg => !msg.is_processing)
                    .map(msg => ({
                      role: msg.sender as 'user' | 'assistant',
                      content: msg.content,
                      references: msg.reference_entries ? Array.isArray(msg.reference_entries) ? msg.reference_entries : [] : undefined,
                      hasNumericResult: msg.has_numeric_result
                    }));
                  setMessages(finalMessages);
                  debugLog.addEvent("Periodic Check", `Found completed response via periodic check for thread: ${currentThreadId}`, "info");
                }
              } catch (error) {
                clearInterval(checkInterval);
                debugLog.addEvent("Periodic Check", `Error during periodic completion check: ${error}`, "error");
              }
            }, 3000); // Check every 3 seconds
            
            // Clean up interval if component unmounts or thread changes
            setTimeout(() => clearInterval(checkInterval), 60000); // Max 1 minute of checking
          }
        }
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

    // Prevent multiple concurrent requests - ONLY useStreamingChat state
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

    // Dispatch force scroll event to ensure all scroll handlers trigger
    window.dispatchEvent(new Event('chat:forceScrollToBottom'));
    
    // Scroll to bottom after adding user message
    setTimeout(scrollToBottom, 100);

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
      
      // Fetch user profile with entry count for mobile interface
      let userProfile: any = { journalEntryCount: 0 };
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('entry_count, timezone, display_name, full_name')
          .eq('id', user.id)
          .single();
        
        if (!profileError && profile) {
          userProfile = {
            journalEntryCount: profile.entry_count || 0,
            timezone: profile.timezone,
            displayName: profile.display_name,
            fullName: profile.full_name
          };
        }
      } catch (error) {
        console.warn('[MobileChatInterface] Failed to fetch user profile:', error);
      }

      await startStreamingChat(
        message,
        user.id,
        currentThreadId,
        conversationContext,
        userProfile
      );

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

    // Prevent deletion if currently processing - ONLY useStreamingChat state
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

  // Check if deletion should be disabled - ONLY useStreamingChat state
  const isDeletionDisabled = isStreaming;
  
  // Calculate if any processing is active - ONLY useStreamingChat state
  const isProcessingActive = isStreaming;

  return (
    <div className="mobile-chat-interface">
      {/* Header */}
      <div className="sticky top-0 z-40 w-full bg-background border-b">
        <div className="container flex h-14 max-w-screen-lg items-center">
          <Sheet open={sheetOpen} onOpenChange={(open) => !isProcessingActive && setSheetOpen(open)}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className={`mr-2 ${
                  isProcessingActive 
                    ? 'text-muted-foreground/50 cursor-not-allowed' 
                    : 'text-muted-foreground hover:text-destructive'
                }`}
                disabled={isProcessingActive}
                title={isProcessingActive ? "Please wait while processing..." : "Toggle Menu"}
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
          
          {/* Manual refresh button for mobile browsers (Android) */}
          {canManualRefresh() && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-2 text-muted-foreground hover:text-primary"
              onClick={triggerManualRefresh}
              title="Refresh chat state"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="sr-only">
                <TranslatableText text="Refresh Chat" />
              </span>
            </Button>
          )}
          
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
        data-chat-messages-container="true"
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
              <ChatErrorBoundary key={index}>
                <MobileChatMessage 
                  message={message} 
                  showAnalysis={false}
                />
              </ChatErrorBoundary>
            ))}
            
            {/* Show streaming status or basic loading */}
            {isStreaming ? (
              <ChatErrorBoundary>
                <MobileChatMessage 
                  message={{ role: 'assistant', content: '' }}
                  streamingMessage={
                    useThreeDotFallback || dynamicMessages.length === 0
                      ? undefined // Show only three-dot animation
                      : translatedDynamicMessages[currentMessageIndex] || dynamicMessages[currentMessageIndex] // Use pre-translated message
                  }
                  showStreamingDots={true}
                />
              </ChatErrorBoundary>
            ) : (!isStreaming && false) ? ( // NO fallback processing states
              <ChatErrorBoundary>
                <MobileChatMessage 
                  message={{ role: 'assistant', content: '' }}
                  isLoading={true}
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
