import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Brain, BarChart2, Search, Lightbulb, Trash2 } from "lucide-react";
import MobileChatMessage from "./MobileChatMessage";
import MobileChatInput from "./MobileChatInput";
import { processChatMessage } from "@/services/chatService";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";
import ChatThreadList from "@/components/chat/ChatThreadList";
import { motion } from "framer-motion";
import { Json } from "@/integrations/supabase/types";
import { ChatMessage as ChatMessageType, getThreadMessages, saveMessage } from "@/services/chatPersistenceService";
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
import { useDebugLog } from "@/utils/debug/DebugContext";
import ChatDiagnosticsModal, { ChatDiagnosticStep } from "../ChatDiagnosticsModal";

type UIChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  references?: any[];
  analysis?: any;
  diagnostics?: any;
  hasNumericResult?: boolean;
}

type ChatMessageFromDB = {
  content: string;
  created_at: string;
  id: string;
  reference_entries: Json | null;
  analysis_data?: Json | null;
  has_numeric_result?: boolean;
  sender: string;
  thread_id: string;
}

interface MobileChatInterfaceProps {
  currentThreadId?: string | null;
  onSelectThread?: (threadId: string) => void;
  onCreateNewThread?: () => Promise<string | null>;
  userId?: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

const MobileChatInterfaceContent = ({
  currentThreadId: propThreadId,
  onSelectThread,
  onCreateNewThread,
  userId,
  onSwipeLeft,
  onSwipeRight
}: MobileChatInterfaceProps) => {
  const [messages, setMessages] = useState<UIChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(propThreadId || null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [diagnosticsModalOpen, setDiagnosticsModalOpen] = useState(false);
  const [currentDiagnostics, setCurrentDiagnostics] = useState<any | null>(null);
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedThreadRef = useRef<string | null>(null);

  useEffect(() => {
    if (propThreadId) {
      setCurrentThreadId(propThreadId);
      loadThreadMessages(propThreadId);
      debugLog.addEvent("Thread Initialization", `Loading prop thread: ${propThreadId}`, "info");
    } else {
      const storedThreadId = localStorage.getItem("lastActiveChatThreadId");
      if (storedThreadId && user?.id) {
        setCurrentThreadId(storedThreadId);
        loadThreadMessages(storedThreadId);
        debugLog.addEvent("Thread Initialization", `Loading stored thread: ${storedThreadId}`, "info");
      } else {
        setInitialLoading(false);
        debugLog.addEvent("Thread Initialization", "No stored thread found", "info");
      }
    }
  }, [propThreadId, user?.id]);

  useEffect(() => {
    const onThreadChange = (event: CustomEvent) => {
      if (event.detail.threadId) {
        setCurrentThreadId(event.detail.threadId);
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
    debugLog.addEvent("Thread Loading", `[Mobile] Loading messages for thread ${threadId}`, "info");
    
    try {
      console.log(`[Mobile] Loading messages for thread ${threadId}`);
      
      const { data: threadData, error: threadError } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('id', threadId)
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
      
      debugLog.addEvent("Thread Loading", `[Mobile] Thread ${threadId} found, fetching messages`, "success");
      const chatMessages = await getThreadMessages(threadId);
      
      if (chatMessages && chatMessages.length > 0) {
        debugLog.addEvent("Thread Loading", `[Mobile] Loaded ${chatMessages.length} messages for thread ${threadId}`, "success");
        console.log(`[Mobile] Loaded ${chatMessages.length} messages for thread ${threadId}`);
        
        const uiMessages = chatMessages.map(msg => ({
          role: msg.sender as 'user' | 'assistant',
          content: msg.content,
          references: msg.reference_entries,
          hasNumericResult: msg.has_numeric_result
        }));
        
        setMessages(uiMessages);
        setShowSuggestions(false);
        loadedThreadRef.current = threadId;
      } else {
        debugLog.addEvent("Thread Loading", `[Mobile] No messages found for thread ${threadId}`, "info");
        console.log(`[Mobile] No messages found for thread ${threadId}`);
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

    let threadId = currentThreadId;
    let isFirstMessage = false;
    
    if (!threadId) {
      try {
        debugLog.addEvent("Thread Creation", "[Mobile] Creating new thread for message", "info");
        if (onCreateNewThread) {
          const newThreadId = await onCreateNewThread();
          if (!newThreadId) {
            throw new Error("Failed to create new thread");
          }
          threadId = newThreadId;
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
          
          threadId = newThreadId;
          setCurrentThreadId(newThreadId);
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
      debugLog.addEvent("Message Check", `[Mobile] Checking if first message in thread ${threadId}`, "info");
      const { count, error } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', threadId);
        
      isFirstMessage = !error && count === 0;
      if (isFirstMessage) {
        debugLog.addEvent("Message Check", `[Mobile] This is the first message in thread ${threadId}`, "info");
      }
    }
    
    debugLog.addEvent("User Message", `[Mobile] Adding user message to UI: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`, "info");
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setLoading(true);
    setProcessingStage("Analyzing your question...");
    
    try {
      debugLog.addEvent("Database", `[Mobile] Saving user message to thread ${threadId}`, "info");
      const savedUserMessage = await saveMessage(threadId, message, 'user');
      debugLog.addEvent("Database", `[Mobile] User message saved: ${savedUserMessage?.id}`, "success");
      console.log("[Mobile] User message saved:", savedUserMessage?.id);
      
      window.dispatchEvent(
        new CustomEvent('messageCreated', { 
          detail: { 
            threadId, 
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
        threadId,
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
        threadId,
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
          .eq('id', threadId);
      }
      
      debugLog.addEvent("Thread Update", `[Mobile] Updating thread timestamp for ${threadId}`, "info");
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);
      
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
          threadId,
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
      setCurrentThreadId(threadId);
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
        console.error("[Mobile] Error deleting messages:", messagesError);
        throw messagesError;
      }
      
      const { error: threadError } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', currentThreadId);
        
      if (threadError) {
        console.error("[Mobile] Error deleting thread:", threadError);
        throw threadError;
      }
      
      setMessages([]);
      setShowSuggestions(true);
      loadedThreadRef.current = null;
      
      if (onCreateNewThread) {
        const newThreadId = await onCreateNewThread();
        if (newThreadId) {
          setCurrentThreadId(newThreadId);
        }
      } else {
        const { data } = await supabase
          .from('chat_threads')
          .select('id')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1);
          
        if (data && data.length > 0) {
          setCurrentThreadId(data[0].id);
          loadThreadMessages(data[0].id);
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
            
          setCurrentThreadId(newThreadId);
        }
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
    <div className="flex flex-col h-full" ref={containerRef}>
      <div className="mobile-chat-header flex items-center justify-between py-2 px-3 sticky top-0 z-10 bg-background border-b">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-1 h-8 w-8">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 sm:max-w-sm w-[85vw]">
            <ChatThreadList 
              userId={userId || user?.id} 
              onSelectThread={handleSelectThread}
              onStartNewThread={handleStartNewThread}
              currentThreadId={currentThreadId}
              newChatButtonWidth="half"
              showDeleteButtons={false}
            />
          </SheetContent>
        </Sheet>
        <h2 className="text-lg font-semibold flex-1 text-center">Rūḥ</h2>
        
        <div className="flex items-center">
          {currentThreadId && messages.length > 0 && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="ml-1 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20"
              onClick={() => setShowDeleteDialog(true)}
              aria-label="Delete conversation"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
      
      <div className="mobile-chat-content flex-1 overflow-y-auto px-2 py-3 space-y-3 flex flex-col">
        {initialLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="ml-2 text-muted-foreground">Loading conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col justify-start h-full mt-6 pt-4">
            <div className="text-center px-4">
              <h3 className="text-xl font-medium mb-2">How can I help you?</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Ask me anything about your mental well-being and journal entries
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
                        <span className="ml-1 flex-grow break-words whitespace-normal">{question.text}</span>
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
            <p className="text-sm text-muted-foreground">{processingStage || "Processing..."}</p>
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
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCurrentThread}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <ChatDiagnosticsModal
        isOpen={diagnosticsModalOpen}
        onClose={() => setDiagnosticsModalOpen(false)}
        diagnostics={currentDiagnostics}
      />
    </div>
  );
};

export default function MobileChatInterface(props: MobileChatInterfaceProps) {
  return <MobileChatInterfaceContent {...props} />;
}
