
import React, { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, X, Plus, BarChart2, Lightbulb, Search, Brain, Trash2 } from "lucide-react";
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

// Define the UIChatMessage interface
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
}

export default function MobileChatInterface({
  currentThreadId: initialThreadId,
  onSelectThread,
  onCreateNewThread,
  userId,
}: MobileChatInterfaceProps) {
  const [messages, setMessages] = useState<UIChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId || null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const debugLog = useDebugLog();
  
  const suggestionQuestions = [
    {
      text: "What were my top emotions last week?",
      icon: <BarChart2 className="h-4 w-4 flex-shrink-0 mr-2" />
    },
    {
      text: "What time of the day do I usually like journaling?", 
      icon: <Lightbulb className="h-4 w-4 flex-shrink-0 mr-2" />
    },
    {
      text: "Am i am introvert? Do i like people in general?",
      icon: <Search className="h-4 w-4 flex-shrink-0 mr-2" />
    },
    {
      text: "What should i particularly do to help my mental health?",
      icon: <Brain className="h-4 w-4 flex-shrink-0 mr-2" />
    },
    {
      text: "Rate my top 3 negative traits out of 100? What do i do to improve them?",
      icon: <Brain className="h-4 w-4 flex-shrink-0 mr-2" />
    }
  ];
  const { toast } = useToast();
  const { user } = useAuth();
  const { translate } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
  }, [messages, loading]);

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
      console.log(`[Mobile] Loading messages for thread ${currentThreadId}`);
      
      const { data: threadData, error: threadError } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('id', currentThreadId)
        .eq('user_id', user.id)
        .single();
        
      if (threadError || !threadData) {
        debugLog.addEvent("Thread Loading", `[Mobile] Thread not found or doesn't belong to user: ${threadError?.message || "Unknown error"}`, "error");
        console.error(`[Mobile] Thread not found or doesn't belong to user:`, threadError);
        setMessages([]);
        setShowSuggestions(true);
        setInitialLoading(false);
        return;
      }
      
      debugLog.addEvent("Thread Loading", `[Mobile] Thread ${currentThreadId} found, fetching messages`, "success");
      const chatMessages = await getThreadMessages(currentThreadId);
      
      if (chatMessages && chatMessages.length > 0) {
        debugLog.addEvent("Thread Loading", `[Mobile] Loaded ${chatMessages.length} messages for thread ${currentThreadId}`, "success");
        console.log(`[Mobile] Loaded ${chatMessages.length} messages for thread ${currentThreadId}`);
        
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
        debugLog.addEvent("Thread Loading", `[Mobile] No messages found for thread ${currentThreadId}`, "info");
        console.log(`[Mobile] No messages found for thread ${currentThreadId}`);
        setMessages([]);
        setShowSuggestions(true);
      }
    } catch (error) {
      debugLog.addEvent("Thread Loading", `[Mobile] Error loading messages: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
      console.error("[Mobile] Error loading messages:", error);
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
      debugLog.addEvent("Authentication", "[Mobile] User not authenticated, message sending blocked", "error");
      return;
    }

    let currentThreadId = threadId;
    let isFirstMessage = false;
    
    if (!currentThreadId) {
      try {
        debugLog.addEvent("Thread Creation", "[Mobile] Creating new thread for message", "info");
        if (onCreateNewThread) {
          const newThreadId = await onCreateNewThread();
          if (!newThreadId) {
            throw new Error("Failed to create new thread");
          }
          currentThreadId = newThreadId;
          debugLog.addEvent("Thread Creation", `[Mobile] New thread created: ${newThreadId}`, "success");
        } else {
          const newThreadId = uuidv4();
          debugLog.addEvent("Thread Creation", `[Mobile] Creating new thread with ID: ${newThreadId}`, "info");
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
            debugLog.addEvent("Thread Creation", `[Mobile] Error creating thread: ${error.message}`, "error");
            throw error;
          }
          
          currentThreadId = newThreadId;
          setThreadId(newThreadId);
          debugLog.addEvent("Thread Creation", `[Mobile] New thread created: ${newThreadId}`, "success");
        }
      } catch (error: any) {
        debugLog.addEvent("Thread Creation", `[Mobile] Error creating thread: ${error.message || "Unknown error"}`, "error");
        console.error("[Mobile] Error creating thread:", error);
        toast({
          title: "Error",
          description: "Failed to create new conversation",
          variant: "destructive"
        });
        return;
      }
    } else {
      debugLog.addEvent("Message Check", `[Mobile] Checking if first message in thread ${currentThreadId}`, "info");
      const { count, error } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', currentThreadId);
        
      isFirstMessage = !error && count === 0;
      if (isFirstMessage) {
        debugLog.addEvent("Message Check", `[Mobile] This is the first message in thread ${currentThreadId}`, "info");
      }
    }
    
    debugLog.addEvent("User Message", `[Mobile] Adding user message to UI: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`, "info");
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setLoading(true);
    setProcessingStage("Analyzing your question...");
    
    try {
      debugLog.addEvent("Database", `[Mobile] Saving user message to thread ${currentThreadId}`, "info");
      const savedUserMessage = await saveMessage(currentThreadId, message, 'user');
      debugLog.addEvent("Database", `[Mobile] User message saved: ${savedUserMessage?.id}`, "success");
      console.log("[Mobile] User message saved:", savedUserMessage?.id);
      
      window.dispatchEvent(
        new CustomEvent('messageCreated', { 
          detail: { 
            threadId: currentThreadId, 
            isFirstMessage,
            content: message
          } 
        })
      );
      
      debugLog.addEvent("Query Analysis", `[Mobile] Analyzing query: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`, "info");
      console.log("[Mobile] Performing comprehensive query analysis for:", message);
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
      
      debugLog.addEvent("Query Analysis", `[Mobile] Analysis result: ${JSON.stringify(analysisDetails)}`, "success");
      console.log("[Mobile] Query analysis result:", queryTypes);
      
      setProcessingStage("Searching for insights...");
      debugLog.addEvent("AI Processing", "[Mobile] Sending query to AI for processing", "info");
      const response = await processChatMessage(
        message, 
        user.id, 
        queryTypes, 
        currentThreadId,
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
      
      debugLog.addEvent("AI Processing", `[Mobile] Response received: ${JSON.stringify(responseInfo)}`, "success");
      console.log("[Mobile] Response received:", responseInfo);
      
      const uiResponse: UIChatMessage = {
        role: response.role === 'error' ? 'assistant' : response.role as 'user' | 'assistant',
        content: response.content,
        ...(response.references && { references: response.references }),
        ...(response.analysis && { analysis: response.analysis }),
        ...(response.hasNumericResult !== undefined && { hasNumericResult: response.hasNumericResult })
      };
      
      if (response.role === 'error' || response.content.includes("issue retrieving")) {
        debugLog.addEvent("AI Processing", `[Mobile] Received error response: ${response.content.substring(0, 100)}...`, "error");
        console.error("[Mobile] Received error response:", response.content);
      }
      
      debugLog.addEvent("Database", "[Mobile] Saving assistant response to database", "info");
      const savedResponse = await saveMessage(
        currentThreadId,
        response.content,
        'assistant',
        response.references || null,
        response.analysis || null,
        response.hasNumericResult || false
      );
      
      debugLog.addEvent("Database", `[Mobile] Assistant response saved: ${savedResponse?.id}`, "success");
      console.log("[Mobile] Assistant response saved:", savedResponse?.id);
      
      if (messages.length === 0) {
        const truncatedTitle = message.length > 30 
          ? message.substring(0, 30) + "..." 
          : message;
          
        debugLog.addEvent("Thread Update", `[Mobile] Updating thread title to: ${truncatedTitle}`, "info");
        await supabase
          .from('chat_threads')
          .update({ 
            title: truncatedTitle,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentThreadId);
      }
      
      debugLog.addEvent("Thread Update", `[Mobile] Updating thread timestamp for ${currentThreadId}`, "info");
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentThreadId);
      
      debugLog.addEvent("UI Update", "[Mobile] Adding assistant response to chat", "info");
      setMessages(prev => [...prev, uiResponse]);
    } catch (error: any) {
      debugLog.addEvent("Error", `[Mobile] Error in message handling: ${error?.message || "Unknown error"}`, "error");
      console.error("[Mobile] Error sending message:", error);
      
      const errorMessageContent = "I'm having trouble processing your request. Please try again later. " + 
                 (error?.message ? `Error: ${error.message}` : "");
      
      debugLog.addEvent("UI Update", "[Mobile] Adding error message to chat", "warning");
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: errorMessageContent
        }
      ]);
      
      try {
        debugLog.addEvent("Database", "[Mobile] Saving error message to database", "info");
        const savedErrorMessage = await saveMessage(
          currentThreadId,
          errorMessageContent,
          'assistant'
        );
        debugLog.addEvent("Database", `[Mobile] Error message saved to database: ${savedErrorMessage?.id}`, "success");
        console.log("[Mobile] Error message saved to database:", savedErrorMessage?.id);
      } catch (e) {
        debugLog.addEvent("Database", `[Mobile] Failed to save error message: ${e instanceof Error ? e.message : "Unknown error"}`, "error");
        console.error("[Mobile] Failed to save error message:", e);
      }
    } finally {
      setLoading(false);
      setProcessingStage(null);
    }
  };

  const handleSelectThread = (threadId: string) => {
    setSheetOpen(false);
    if (onSelectThread) {
      onSelectThread(threadId);
    } else {
      setThreadId(threadId);
      loadThreadMessages(threadId);
    }
  };

  const handleStartNewThread = async (): Promise<string | null> => {
    setSheetOpen(false);
    loadedThreadRef.current = null;
    if (onCreateNewThread) {
      const newThreadId = await onCreateNewThread();
      return newThreadId;
    }
    return null;
  };

  const handleDeleteCurrentThread = async () => {
    if (!threadId || !user?.id) {
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
        .eq('thread_id', threadId);
        
      if (messagesError) {
        console.error("[Mobile] Error deleting messages:", messagesError);
        throw messagesError;
      }
      
      const { error: threadError } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', threadId);
        
      if (threadError) {
        console.error("[Mobile] Error deleting thread:", threadError);
        throw threadError;
      }
      
      setMessages([]);
      setShowSuggestions(true);
      loadedThreadRef.current = null;

      const { data: threads, error } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (threads && threads.length > 0) {
        setThreadId(threads[0].id);
        loadThreadMessages(threads[0].id);
      } else {
        const newThreadId = uuidv4();
        await supabase
          .from('chat_threads')
          .insert({
            id: newThreadId,
            user_id: user.id,
            title: "New Conversation",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        setThreadId(newThreadId);
      }

      toast({
        title: "Success",
        description: "Conversation deleted successfully",
      });
      
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("[Mobile] Error deleting thread:", error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="mobile-chat-interface h-full flex flex-col pb-20 relative">
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
                  onClick={() => {
                    onCreateNewThread();
                    setSheetOpen(false);
                  }}
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                  <TranslatableText text="New Chat" />
                </Button>
                {/* Removed extra close button here */}
              </SheetHeader>
              
              <div className="mt-2 h-[calc(100vh-80px)]">
                <ChatThreadList
                  activeThreadId={threadId}
                  onSelectThread={(threadId) => {
                    onSelectThread(threadId);
                    // Close the sheet after selecting a thread
                    setSheetOpen(false);
                  }}
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
            className="ml-2"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-5 w-5" />
            <span className="sr-only">
              <TranslatableText text="Delete Chat" />
            </span>
          </Button>
        </div>
      </div>
      
      <div className="mobile-chat-content flex-1 overflow-y-auto px-2 py-3 space-y-3 flex flex-col pb-24">
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
                    >
                      <div className="flex items-start w-full">
                        <span className="flex-shrink-0 mt-0.5">{question.icon}</span>
                        <span className="ml-1 flex-grow break-words whitespace-normal">
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
          <div className="flex-grow space-y-3">
            {messages.map((message, index) => (
              <MobileChatMessage 
                key={index} 
                message={message} 
                showAnalysis={false}
              />
            ))}
          </div>
        )}
        
        {loading && (
          <div className="flex flex-col items-center justify-center space-y-2 p-4 rounded-lg bg-primary/5">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
            <p className="text-sm text-muted-foreground">
              <TranslatableText text={processingStage || "Processing..."} />
            </p>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="mobile-chat-input-container fixed bottom-16 left-0 right-0 bg-background border-t">
        <MobileChatInput 
          onSendMessage={handleSendMessage} 
          isLoading={loading}
          userId={userId || user?.id}
        />
      </div>
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <TranslatableText text="Delete this conversation?" />
            </AlertDialogTitle>
            <AlertDialogDescription>
              <TranslatableText text="This will permanently delete this conversation and all its messages. This action cannot be undone." />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel><TranslatableText text="Cancel" /></AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCurrentThread}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <TranslatableText text="Delete" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
