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
import { updateThreadProcessingStatus } from "@/utils/chat/threadUtils";
import { useKeyboardDetection } from "@/hooks/use-keyboard-detection";
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
  const debugLog = useDebugLog();
  
  const {
    isLoading,
    isProcessing,
    processingStatus,
    setLocalLoading
  } = useChatRealtime(threadId);
  
  const { isKeyboardVisible } = useKeyboardDetection();
  
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
  const loadedThreadRef = useRef<string | null>(null);

  useEffect(() => {
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
  }, [threadId, user?.id]);
  
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
        const uiMessages = chatMessages.map(msg => ({
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
    
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setLocalLoading(true, "Processing your request...");
    
    try {
      await updateThreadProcessingStatus(currentThreadId, 'processing');
      
      const savedUserMessage = await saveMessage(currentThreadId, message, 'user', user.id);
      
      window.dispatchEvent(
        new CustomEvent('messageCreated', { 
          detail: { 
            threadId: currentThreadId, 
            isFirstMessage,
            content: message
          } 
        })
      );
      
      const queryTypes = analyzeQueryTypes(message);
      
      const response = await processChatMessage(
        message, 
        user.id, 
        queryTypes, 
        currentThreadId,
        false
      );
      
      await updateThreadProcessingStatus(currentThreadId, 'idle');
      
      const uiResponse: UIChatMessage = {
        role: response.role === 'error' ? 'assistant' : response.role as 'user' | 'assistant',
        content: response.content,
        ...(response.references && { references: response.references }),
        ...(response.analysis && { analysis: response.analysis }),
        ...(response.hasNumericResult !== undefined && { hasNumericResult: response.hasNumericResult })
      };
      
      const savedResponse = await saveMessage(
        currentThreadId,
        response.content,
        'assistant',
        user.id,
        response.references || null,
        response.hasNumericResult || false
      );
      
      if (messages.length === 0) {
        const truncatedTitle = message.length > 30 
          ? message.substring(0, 30) + "..." 
          : message;
          
        await supabase
          .from('chat_threads')
          .update({ 
            title: truncatedTitle,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentThreadId);
      }
      
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentThreadId);
      
      setMessages(prev => [...prev, uiResponse]);
    } catch (error: any) {
      if (currentThreadId) {
        await updateThreadProcessingStatus(currentThreadId, 'failed');
      }
      
      const errorMessageContent = "I'm having trouble processing your request. Please try again later. " + 
                 (error?.message ? `Error: ${error.message}` : "");
      
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: errorMessageContent
        }
      ]);
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

    if (isProcessing || processingStatus === 'processing') {
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

  const isDeletionDisabled = isProcessing || processingStatus === 'processing' || isLoading;

  return (
    <div className="mobile-chat-interface">
      {/* Header */}
      <div className="sticky top-0 z-40 w-full bg-background border-b safe-area-top">
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
            {messages.map((message, index) => (
              <MobileChatMessage 
                key={index} 
                message={message} 
                showAnalysis={false}
              />
            ))}
            
            {(isLoading || isProcessing) && (
              <MobileChatMessage 
                message={{ role: 'assistant', content: '' }}
                isLoading={true}
              />
            )}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Chat Input */}
      <MobileChatInput 
        onSendMessage={handleSendMessage} 
        isLoading={isLoading || isProcessing}
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
