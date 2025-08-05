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
import { getThreadMessages, saveMessage } from "@/services/chat";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { processChatMessage } from "@/services/chatService";
import { MentalHealthInsights } from "@/hooks/use-mental-health-insights";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { updateThreadProcessingStatus, generateThreadTitle } from "@/utils/chat/threadUtils";
import { useKeyboardDetection } from "@/hooks/use-keyboard-detection";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import { useChatState, UIChatMessage } from "@/hooks/useChatState";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
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

// UIChatMessage now imported from useChatState hook

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
  const debugLog = useDebugLog();
  
  // Use centralized state management
  const { state, actions, loadedThreadRef, addCleanupFunction } = useChatState(initialThreadId);
  
  const {
    messages,
    threadId,
    showSuggestions,
    initialLoading,
    showDeleteDialog,
    sheetOpen,
    error
  } = state;
  
  const {
    isLoading,
    isProcessing,
    processingStatus,
    setLocalLoading
  } = useChatRealtime(threadId);
  
  const { isKeyboardVisible } = useKeyboardDetection();
  
  // Use streaming chat for enhanced UX
  const {
    isStreaming,
    streamingMessages,
    currentUserMessage,
    showBackendAnimation,
    startStreamingChat,
    dynamicMessages,
    currentMessageIndex,
    useThreeDotFallback
  } = useStreamingChat({
    onFinalResponse: async (response, analysis, analysisMetadata) => {
      // Handle final streaming response
      if (!response || !threadId || !user?.id) {
        debugLog.addEvent("Streaming Response", "[Mobile] Missing required data for final response", "error");
        console.error("[Mobile] [Streaming] Missing response data:", { response: !!response, threadId: !!threadId, userId: !!user?.id });
        return;
      }
      
      debugLog.addEvent("Streaming Response", `[Mobile] Final response received: ${response.substring(0, 100)}...`, "success");
      
      try {
        // Save the assistant response to database
        debugLog.addEvent("Database", "[Mobile] Saving streaming assistant response to database", "info");
        const savedResponse = await saveMessage(
          threadId,
          response,
          'assistant',
          user.id,
          analysis?.references || undefined,
          analysis?.hasNumericResult || false
        );
        
        if (savedResponse) {
          debugLog.addEvent("Database", `[Mobile] Streaming assistant response saved with ID: ${savedResponse.id}`, "success");
          
          // Add the saved response to messages
          actions.addMessage({
            role: 'assistant',
            content: response,
            references: analysis?.references,
            analysis: analysis || undefined,
            hasNumericResult: analysis?.hasNumericResult || false
          });
        } else {
          debugLog.addEvent("Database", "[Mobile] Failed to save streaming response - null response", "error");
          throw new Error("Failed to save streaming response");
        }
      } catch (saveError) {
        debugLog.addEvent("Database", `[Mobile] Error saving streaming response: ${saveError instanceof Error ? saveError.message : "Unknown error"}`, "error");
        console.error("[Mobile] [Streaming] Failed to save response:", saveError);
        
        // Fallback: Add temporary message to UI
        actions.addMessage({
          role: 'assistant',
          content: response,
          ...(analysis && { analysis })
        });
        
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadId) {
      actions.setInitialLoading(true);
      loadThreadMessages(threadId);
      debugLog.addEvent("Thread Initialization", `Loading current thread: ${threadId}`, "info");
    } else {
      const storedThreadId = localStorage.getItem("lastActiveChatThreadId");
      if (storedThreadId && user?.id) {
        actions.setInitialLoading(true);
        actions.setThreadId(storedThreadId);
        loadThreadMessages(storedThreadId);
        debugLog.addEvent("Thread Initialization", `Loading stored thread: ${storedThreadId}`, "info");
      } else {
        // No thread to load - show suggestions immediately
        actions.setInitialLoading(false);
        actions.setShowSuggestions(true);
        debugLog.addEvent("Thread Initialization", "No stored thread found, showing suggestions", "info");
      }
    }
  }, [threadId, user?.id, actions, debugLog]);
  
  useEffect(() => {
    const onThreadChange = (event: CustomEvent) => {
      if (event.detail.threadId) {
        actions.setThreadId(event.detail.threadId);
        loadThreadMessages(event.detail.threadId);
        debugLog.addEvent("Thread Change", `Thread selected: ${event.detail.threadId}`, "info");
      }
    };
    
    window.addEventListener('threadSelected' as any, onThreadChange);
    
    const cleanup = () => {
      window.removeEventListener('threadSelected' as any, onThreadChange);
    };
    
    addCleanupFunction(cleanup);
    return cleanup;
  }, [actions, debugLog, addCleanupFunction]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isProcessing]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const loadThreadMessages = async (currentThreadId: string) => {
    if (!currentThreadId || !user?.id) {
      actions.setInitialLoading(false);
      actions.setShowSuggestions(true);
      return;
    }
    
    if (loadedThreadRef.current === currentThreadId) {
      debugLog.addEvent("Thread Loading", `Thread ${currentThreadId} already loaded, skipping`, "info");
      actions.setInitialLoading(false);
      return;
    }
    
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
        actions.setMessages([]);
        actions.setShowSuggestions(true);
        actions.setInitialLoading(false);
        return;
      }
      
      const chatMessages = await getThreadMessages(currentThreadId, user.id);
      
      if (chatMessages && chatMessages.length > 0) {
        const uiMessages = chatMessages.map((msg, index) => ({
          id: `${msg.id || Date.now()}-${index}`, // Ensure unique ID
          role: msg.sender as 'user' | 'assistant',
          content: msg.content,
          references: msg.reference_entries ? Array.isArray(msg.reference_entries) ? msg.reference_entries : [] : undefined,
          hasNumericResult: msg.has_numeric_result,
          timestamp: new Date(msg.created_at || Date.now()).getTime()
        }));
        
        actions.setMessages(uiMessages);
        actions.setShowSuggestions(false);
        loadedThreadRef.current = currentThreadId;
      } else {
        actions.setMessages([]);
        actions.setShowSuggestions(true);
      }
    } catch (error) {
      debugLog.addEvent("Thread Loading", `[Mobile] Error loading messages: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
      toast({
        title: "Error loading messages",
        description: "Could not load conversation history.",
        variant: "destructive"
      });
      actions.setMessages([]);
      actions.setShowSuggestions(true);
    } finally {
      actions.setInitialLoading(false);
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

    if (isProcessing || isLoading) {
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
          actions.setThreadId(newThreadId);
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
    
    actions.addMessage({ role: 'user', content: message });
    setLocalLoading(true, "Processing your request...");
    
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
      
      // Start streaming chat with conversation context
      await startStreamingChat(
        message,
        user.id,
        currentThreadId,
        conversationContext,
        {}
      );
      
      await updateThreadProcessingStatus(currentThreadId, 'idle');
    } catch (error: any) {
      if (currentThreadId) {
        await updateThreadProcessingStatus(currentThreadId, 'failed');
      }
      
      const errorMessageContent = "I'm having trouble processing your request. Please try again later. " + 
                 (error?.message ? `Error: ${error.message}` : "");
      
      actions.addMessage({
        role: 'assistant', 
        content: errorMessageContent
      });
    } finally {
      setLocalLoading(false);
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
      actions.setInitialLoading(true);
      
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
        actions.setInitialLoading(false);
        return;
      }

      // Close sheet immediately after verification
      actions.setSheetOpen(false);
      
      // Update thread state and load messages
      actions.setThreadId(selectedThreadId);
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
      actions.setInitialLoading(false);
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

    if (isProcessing || processingStatus === 'processing') {
      console.log('[MobileChat] Cannot delete thread while processing');
      toast({
        title: "Cannot delete conversation",
        description: "Please wait for the current request to complete before deleting this conversation.",
        variant: "destructive"
      });
      actions.setShowDeleteDialog(false);
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
      
      // Dispatch event to update sidebar
      window.dispatchEvent(
        new CustomEvent('threadDeleted', {
          detail: { threadId }
        })
      );
      
      // Clear current state
      actions.setMessages([]);
      actions.setShowSuggestions(true);
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
        actions.setThreadId(threads[0].id);
        localStorage.setItem("lastActiveChatThreadId", threads[0].id);
        await loadThreadMessages(threads[0].id);
      } else {
        // No threads left, create a new one
        console.log('[MobileChat] No remaining threads, creating new one');
        try {
          const newThreadId = await onCreateNewThread();
          if (newThreadId) {
            actions.setThreadId(newThreadId);
            localStorage.setItem("lastActiveChatThreadId", newThreadId);
          } else {
            // Fallback if creation fails
            actions.setThreadId(null);
          }
        } catch (createError) {
          console.error('[MobileChat] Error creating new thread after deletion:', createError);
          actions.setThreadId(null);
        }
      }

      toast({
        title: "Success",
        description: "Conversation deleted successfully",
      });
      
      actions.setShowDeleteDialog(false);
      
    } catch (error) {
      console.error('[MobileChat] Error deleting conversation:', error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
      actions.setShowDeleteDialog(false);
    }
  };

  const isDeletionDisabled = isProcessing || processingStatus === 'processing' || isLoading;

  return (
    <ErrorBoundary>
      <div className="mobile-chat-interface">
      {/* Header */}
      <div className="sticky top-0 z-40 w-full bg-background border-b safe-area-top">
        <div className="container flex h-14 max-w-screen-lg items-center">
          <Sheet open={sheetOpen} onOpenChange={actions.setSheetOpen}>
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

                      actions.setSheetOpen(false);
                      actions.setInitialLoading(true);
                      
                      const newThreadId = await onCreateNewThread();
                      if (newThreadId) {
                        console.log('[MobileChat] New thread created:', newThreadId);
                        actions.setThreadId(newThreadId);
                        actions.setMessages([]);
                        actions.setShowSuggestions(true);
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
                      actions.setInitialLoading(false);
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
            onClick={() => !isDeletionDisabled && actions.setShowDeleteDialog(true)}
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
      <div className="mobile-chat-content">
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
                      disabled={isLoading || isProcessing}
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
            {messages.map((message) => (
              <MobileChatMessage 
                key={message.id} 
                message={message} 
                showAnalysis={false}
              />
            ))}
            
            {/* Show streaming status or basic loading */}
            {isStreaming ? (
              <MobileChatMessage 
                message={{ role: 'assistant', content: '' }}
                streamingMessage={
                  useThreeDotFallback || dynamicMessages.length === 0
                    ? undefined // Show only three-dot animation
                    : dynamicMessages[currentMessageIndex] // Show dynamic message
                }
                showStreamingDots={true}
              />
            ) : (isLoading || isProcessing) && (
              <MobileChatMessage 
                message={{ role: 'assistant', content: '' }}
                isLoading={true}
              />
            )}
          </div>
        )}
        
        {/* Legacy streaming display removed - now integrated into message flow */}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Chat Input */}
      <MobileChatInput 
        onSendMessage={handleSendMessage} 
        isLoading={isLoading || isProcessing}
        userId={userId || user?.id}
      />
      
      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={actions.setShowDeleteDialog}>
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
    </ErrorBoundary>
  );
}
