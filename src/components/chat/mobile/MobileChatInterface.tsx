import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, X, Brain, BarChart2, Search, Lightbulb } from "lucide-react";
import MobileChatMessage from "./MobileChatMessage";
import MobileChatInput from "./MobileChatInput";
import { processChatMessage, ChatMessage as ChatMessageType } from "@/services/chatService";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";
import ChatThreadList from "@/components/chat/ChatThreadList";
import ChatDiagnostics from "@/components/chat/ChatDiagnostics";
import { Json } from "@/integrations/supabase/types";
import { motion } from "framer-motion";
import EmptyChatState from "@/components/chat/EmptyChatState";

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
  const [showDebug, setShowDebug] = useState(false);
  const [ragDiagnostics, setRagDiagnostics] = useState<any>({
    steps: [],
    isActive: false,
    error: null,
    queryText: '',
    references: null,
    similarityScores: null,
    queryAnalysis: null,
    functionExecutions: null
  });
  const [showSuggestions, setShowSuggestions] = useState(true);
  const suggestionQuestions = [
    {
      text: "How did I feel yesterday?",
      icon: <BarChart2 className="h-4 w-4 mr-1" />
    },
    {
      text: "What makes me happy?", 
      icon: <Lightbulb className="h-4 w-4 mr-1" />
    },
    {
      text: "Find entries about work",
      icon: <Search className="h-4 w-4 mr-1" />
    }
  ];
  const { toast } = useToast();
  const { user } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const addRagDiagnosticStep = (step: string, status: 'pending' | 'success' | 'error' | 'loading', details?: string) => {
    setRagDiagnostics(prev => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          id: prev.steps.length + 1,
          step,
          status,
          details,
          timestamp: new Date().toLocaleTimeString()
        }
      ]
    }));
  };

  const loadThreadMessages = async (threadId: string) => {
    if (!threadId || !user?.id) return;
    
    try {
      console.log(`[Mobile] Loading messages for thread ${threadId}`);
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
        const formattedMessages = data.map((msg: ChatMessageFromDB) => ({
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
    } catch (error) {
      console.error("[Mobile] Error loading messages:", error);
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

    setRagDiagnostics({
      steps: [],
      isActive: true,
      error: null,
      queryText: message,
      references: null,
      similarityScores: null,
      queryAnalysis: null,
      functionExecutions: null
    });
    
    addRagDiagnosticStep("Initializing chat request", "success", "Starting to process your query");

    let threadId = currentThreadId;
    let isFirstMessage = false;
    
    if (!threadId) {
      try {
        addRagDiagnosticStep("Creating new thread", "loading");
        
        if (onCreateNewThread) {
          const newThreadId = await onCreateNewThread();
          if (!newThreadId) {
            throw new Error("Failed to create new thread");
          }
          threadId = newThreadId;
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
            addRagDiagnosticStep("Creating new thread", "error", error.message);
            throw error;
          }
          
          addRagDiagnosticStep("Creating new thread", "success", `Thread created with ID: ${newThreadId}`);
          threadId = newThreadId;
          setCurrentThreadId(newThreadId);
        }
      } catch (error: any) {
        console.error("[Mobile] Error creating thread:", error);
        addRagDiagnosticStep("Creating new thread", "error", error.message);
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
    
    addRagDiagnosticStep("Saving user message", "loading");
    
    try {
      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          content: message,
          sender: 'user'
        });
        
      if (msgError) {
        addRagDiagnosticStep("Saving user message", "error", msgError.message);
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
      
      addRagDiagnosticStep("Saving user message", "success");
      
      addRagDiagnosticStep("Analyzing query intent", "loading");
      console.log("[Mobile] Performing comprehensive query analysis for:", message);
      setProcessingStage("Analyzing patterns in your journal...");
      const queryTypes = analyzeQueryTypes(message);
      addRagDiagnosticStep("Analyzing query intent", "success", 
        `Detected: ${JSON.stringify({
          isEmotionFocused: queryTypes.isEmotionFocused,
          isQuantitative: queryTypes.isQuantitative,
          isWhyQuestion: queryTypes.isWhyQuestion,
          needsVectorSearch: queryTypes.needsVectorSearch
        })}`);
      console.log("[Mobile] Query analysis result:", queryTypes);
      
      setRagDiagnostics(prev => ({
        ...prev,
        queryAnalysis: {
          queryType: queryTypes.isEmotionFocused ? 'emotional' : 'general',
          emotion: queryTypes.isEmotionFocused ? queryTypes.emotion || null : null,
          theme: queryTypes.isThemeFocused ? queryTypes.theme || null : null,
          timeframe: {
            timeType: queryTypes.timeRange,
            startDate: queryTypes.startDate || null,
            endDate: queryTypes.endDate || null
          },
          isWhenQuestion: queryTypes.isWhenQuestion || false
        }
      }));
      
      addRagDiagnosticStep("Processing with RAG service", "loading");
      setProcessingStage("Searching for insights...");
      const response = await processChatMessage(
        message, 
        user.id, 
        queryTypes, 
        threadId,
        true // Enable diagnostics mode
      );
      
      if (response.diagnostics) {
        if (response.diagnostics.steps) {
          response.diagnostics.steps.forEach((step: any) => {
            addRagDiagnosticStep(step.name, step.status, step.details);
          });
        }
        
        if (response.diagnostics.functionCalls) {
          setRagDiagnostics(prev => ({
            ...prev,
            functionExecutions: response.diagnostics.functionCalls
          }));
        }
        
        if (response.diagnostics.similarityScores) {
          setRagDiagnostics(prev => ({
            ...prev,
            similarityScores: response.diagnostics.similarityScores
          }));
        }
      }
      
      if (response.references) {
        setRagDiagnostics(prev => ({
          ...prev,
          references: response.references
        }));
      }
      
      addRagDiagnosticStep("Processing with RAG service", "success", 
        `Received response with ${response.references?.length || 0} references`);
      
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
        addRagDiagnosticStep("Processing error", "error", response.content);
      }
      
      addRagDiagnosticStep("Saving assistant response", "loading");
      
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
        addRagDiagnosticStep("Saving assistant response", "error", storeError.message);
      } else {
        addRagDiagnosticStep("Saving assistant response", "success");
      }
      
      if (messages.length === 0) {
        addRagDiagnosticStep("Updating thread title", "loading");
        
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
          
        addRagDiagnosticStep("Updating thread title", "success");
      }
      
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);
      
      addRagDiagnosticStep("Processing complete", "success", "All steps completed successfully");
      
      setMessages(prev => [...prev, uiResponse]);
    } catch (error: any) {
      console.error("[Mobile] Error sending message:", error);
      addRagDiagnosticStep("Processing error", "error", error?.message || "Unknown error");
      setRagDiagnostics(prev => ({
        ...prev,
        error: error?.message || "Unknown error"
      }));
      
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

  const handleStartNewThread = async () => {
    setSheetOpen(false);
    if (onCreateNewThread) {
      await onCreateNewThread();
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
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => setShowDebug(!showDebug)}
        >
          <Brain className="h-5 w-5" />
        </Button>
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
        
        {showDebug && ragDiagnostics.steps.length > 0 && (
          <ChatDiagnostics
            queryText={ragDiagnostics.queryText}
            isVisible={showDebug}
            ragSteps={ragDiagnostics.steps}
            references={ragDiagnostics.references}
            similarityScores={ragDiagnostics.similarityScores}
            queryAnalysis={ragDiagnostics.queryAnalysis}
            functionExecutions={ragDiagnostics.functionExecutions}
          />
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
    </div>
  );
}
