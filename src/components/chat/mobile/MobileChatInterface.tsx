import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { 
  Menu, 
  X, 
  Brain, 
  BarChart2, 
  Search, 
  Lightbulb,
  Trash
} from "lucide-react";
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
  reference_entries: any | null;
  analysis_data: any | null;
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

export default function MobileChatInterface({
  currentThreadId: propThreadId,
  onSelectThread,
  onCreateNewThread,
  userId,
  onSwipeLeft,
  onSwipeRight
}: MobileChatInterfaceProps) {
  const [messages, setMessages] = useState<UIChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(propThreadId || null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const suggestionQuestions = [
    {
      text: "What are the top 3 reasons that make me happy?",
      icon: <Lightbulb className="h-4 w-4 mr-1" />
    },
    {
      text: "What time of the day do i usually journal?",
      icon: <Search className="h-4 w-4 mr-1" />
    },
    {
      text: "Top 3 issues in my life?",
      icon: <BarChart2 className="h-4 w-4 mr-1" />
    },
    {
      text: "Suggest me ways to improve my negative traits.",
      icon: <Brain className="h-4 w-4 mr-1" />
    },
    {
      text: "Rate my top 3 emotions out of 10 for each of them.",
      icon: <BarChart2 className="h-4 w-4 mr-1" />
    }
  ];
  const { toast } = useToast();
  const { user } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasLoadedMessages, setHasLoadedMessages] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [currentThreadTitle, setCurrentThreadTitle] = useState("");

  useEffect(() => {
    if (propThreadId) {
      setCurrentThreadId(propThreadId);
      loadThreadMessages(propThreadId);
    }
  }, [propThreadId]);

  useEffect(() => {
    const onThreadChange = (event: CustomEvent) => {
      if (event.detail.threadId) {
        setCurrentThreadId(event.detail.threadId);
        loadThreadMessages(event.detail.threadId);
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

  useEffect(() => {
    if (currentThreadId && user?.id && !initialLoadComplete) {
      setInitialLoadComplete(true);
      loadThreadMessages(currentThreadId);
    }
  }, [currentThreadId, user?.id, initialLoadComplete]);

  useEffect(() => {
    if (currentThreadId) {
      fetchThreadTitle(currentThreadId);
    }
  }, [currentThreadId]);

  const fetchThreadTitle = async (threadId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_threads')
        .select('title')
        .eq('id', threadId)
        .single();
        
      if (error) throw error;
      
      if (data) {
        setCurrentThreadTitle(data.title);
      }
    } catch (error) {
      console.error("[Mobile] Error fetching thread title:", error);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const loadThreadMessages = async (threadId: string) => {
    if (!threadId || !user?.id) return;
    
    try {
      console.log(`[Mobile] Loading messages for thread ${threadId}`);
      setLoading(true);
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
        
      if (error) {
        console.error(`[Mobile] Error loading messages:`, error);
        throw error;
      }
      
      console.log(`[Mobile] Loaded ${data?.length || 0} messages`);
      
      if (data && data.length > 0) {
        const formattedMessages = data.map((msg: any) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content,
          ...(msg.reference_entries && { references: msg.reference_entries }),
          ...(msg.analysis_data && { analysis: msg.analysis_data }),
          ...(msg.has_numeric_result !== undefined && { hasNumericResult: msg.has_numeric_result })
        })) as UIChatMessage[];
        
        setMessages(formattedMessages);
        setShowSuggestions(false);
      } else {
        setMessages([]);
        setShowSuggestions(true);
      }
      
      setHasLoadedMessages(true);
    } catch (error) {
      console.error("[Mobile] Error loading messages:", error);
      toast({
        title: "Error",
        description: "Unable to load conversation history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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

    let threadId = currentThreadId;
    let isFirstMessage = false;
    
    if (!threadId) {
      try {
        if (onCreateNewThread) {
          const newThreadId = await onCreateNewThread();
          if (!newThreadId) {
            throw new Error("Failed to create new thread");
          }
          threadId = newThreadId;
          setCurrentThreadId(newThreadId);
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
            throw error;
          }
          
          threadId = newThreadId;
          setCurrentThreadId(newThreadId);
        }
      } catch (error: any) {
        console.error("[Mobile] Error creating thread:", error);
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
        .eq('thread_id', threadId);
        
      isFirstMessage = !error && count === 0;
    }
    
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setLoading(true);
    setProcessingStage("Analyzing your question...");
    
    try {
      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          content: message,
          sender: 'user'
        });
        
      if (msgError) {
        throw msgError;
      }
      
      window.dispatchEvent(
        new CustomEvent('messageCreated', { 
          detail: { 
            threadId, 
            isFirstMessage,
            content: message
          } 
        })
      );
      
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
      
      console.log("[Mobile] Query analysis result:", queryTypes);
      
      setProcessingStage("Searching for insights...");
      const response = await processChatMessage(
        message, 
        user.id, 
        queryTypes, 
        threadId,
        false
      );
      
      console.log("[Mobile] Response received:", {
        role: response.role,
        hasReferences: !!response.references?.length,
        refCount: response.references?.length || 0,
        hasAnalysis: !!response.analysis,
        hasNumericResult: response.hasNumericResult,
        errorState: response.role === 'error'
      });
      
      const uiResponse: UIChatMessage = {
        role: response.role === 'error' ? 'assistant' : response.role as 'user' | 'assistant',
        content: response.content,
        ...(response.references && { references: response.references }),
        ...(response.analysis && { analysis: response.analysis }),
        ...(response.hasNumericResult !== undefined && { hasNumericResult: response.hasNumericResult })
      };
      
      if (response.role === 'error' || response.content.includes("issue retrieving")) {
        console.error("[Mobile] Received error response:", response.content);
      }
      
      const { error: storeError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          content: response.content,
          sender: 'assistant',
          reference_entries: response.references || null,
          has_numeric_result: response.hasNumericResult || false,
          analysis_data: response.analysis || null
        });
          
      if (storeError) {
        console.error("[Mobile] Error storing assistant response:", storeError);
      }
      
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
          .eq('id', threadId);
      }
      
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);
      
      setMessages(prev => [...prev, uiResponse]);
    } catch (error: any) {
      console.error("[Mobile] Error sending message:", error);
      
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: "I'm having trouble processing your request. Please try again later. " + 
                   (error?.message ? `Error: ${error.message}` : "")
        }
      ]);
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
    if (onCreateNewThread) {
      const newThreadId = await onCreateNewThread();
      return newThreadId;
    }
    return null;
  };
  
  const handleDeleteThread = async () => {
    if (!currentThreadId) return;
    
    try {
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('thread_id', currentThreadId);
        
      if (messagesError) throw messagesError;
      
      const { error: threadError } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', currentThreadId);
        
      if (threadError) throw threadError;
      
      // Reset states
      setMessages([]);
      setCurrentThreadId(null);
      localStorage.removeItem("lastActiveChatThreadId");
      setIsDeleteDialogOpen(false);
      setShowSuggestions(true);
      
      toast({
        title: "Thread deleted",
        description: "The conversation has been deleted successfully.",
      });
      
      // Create a new thread automatically
      if (onCreateNewThread) {
        await onCreateNewThread();
      } else {
        const newThreadId = uuidv4();
        if (user?.id) {
          const { error } = await supabase
            .from('chat_threads')
            .insert({
              id: newThreadId,
              user_id: user.id,
              title: "New Conversation",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (!error) {
            setCurrentThreadId(newThreadId);
            localStorage.setItem("lastActiveChatThreadId", newThreadId);
            window.dispatchEvent(
              new CustomEvent('threadSelected', { 
                detail: { threadId: newThreadId } 
              })
            );
          }
        }
      }
      
      // Notify other components that thread was deleted
      window.dispatchEvent(
        new CustomEvent('threadDeleted', { 
          detail: { threadId: currentThreadId } 
        })
      );
    } catch (error) {
      console.error("[Mobile] Error deleting thread:", error);
      
      toast({
        title: "Error",
        description: "Failed to delete the conversation.",
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
            <div className="flex justify-end p-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9" 
                onClick={() => setSheetOpen(false)}
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
            <ChatThreadList 
              userId={userId || user?.id} 
              onSelectThread={handleSelectThread}
              onStartNewThread={handleStartNewThread}
              currentThreadId={currentThreadId}
              newChatButtonWidth="half"
            />
          </SheetContent>
        </Sheet>
        <h2 className="text-lg font-semibold flex-1 text-center">Roha</h2>
        {messages.length > 0 && currentThreadId && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash className="h-5 w-5" />
            <span className="sr-only">Delete</span>
          </Button>
        )}
      </div>
      
      <div className="mobile-chat-content flex-1 overflow-y-auto px-2 py-3 space-y-3 flex flex-col">
        {messages.length === 0 ? (
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
                      className="px-3 py-2 h-auto justify-start text-sm text-left bg-muted/50 hover:bg-muted"
                      onClick={() => handleSendMessage(question.text)}
                    >
                      {question.icon}
                      <span>{question.text}</span>
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
      
      <AlertDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteThread}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
