import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { 
  Loader2, 
  BarChart4, 
  Brain, 
  BarChart2, 
  Search, 
  Lightbulb,
  MoreVertical,
  Pencil,
  Trash
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { processChatMessage, ChatMessage as ChatMessageType } from "@/services/chatService";
import { motion } from "framer-motion";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";
import ChatDiagnostics from './ChatDiagnostics';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

type DbChatMessage = {
  content: string;
  created_at: string;
  id: string;
  reference_entries: any;
  sender: string;
  thread_id: string;
  analysis_data?: any;
  has_numeric_result?: boolean;
}

const THREAD_ID_STORAGE_KEY = "lastActiveChatThreadId";

export default function SmartChatInterface() {
  const [isLoading, setIsLoading] = useState(false);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<UIChatMessage[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [hasLoadedMessages, setHasLoadedMessages] = useState(false);
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [currentThreadTitle, setCurrentThreadTitle] = useState("");

  const demoQuestions = [
    {
      text: "How did I feel yesterday?",
      icon: <BarChart2 className="h-4 w-4 mr-2" />
    },
    {
      text: "What makes me happy?",
      icon: <Lightbulb className="h-4 w-4 mr-2" />
    },
    {
      text: "Find entries about work",
      icon: <Search className="h-4 w-4 mr-2" />
    },
    {
      text: "What were my top 3 positive and negative emotions last month?",
      icon: <Brain className="h-4 w-4 mr-2" />
    }
  ];

  useEffect(() => {
    if (user?.id) {
      const storedThreadId = localStorage.getItem(THREAD_ID_STORAGE_KEY);
      
      if (storedThreadId) {
        console.log("Restoring chat thread from localStorage:", storedThreadId);
        setCurrentThreadId(storedThreadId);
      } else {
        fetchUserThreads();
      }
    }
  }, [user]);

  const fetchUserThreads = async () => {
    if (!user?.id) return;
    
    try {
      const { data: threads, error } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);
        
      if (error) throw error;
      
      if (threads && threads.length > 0) {
        const mostRecentThreadId = threads[0].id;
        console.log("Found most recent thread:", mostRecentThreadId);
        setCurrentThreadId(mostRecentThreadId);
        localStorage.setItem(THREAD_ID_STORAGE_KEY, mostRecentThreadId);
      }
    } catch (error) {
      console.error("Error fetching user threads:", error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isLoading]);
  
  useEffect(() => {
    if (currentThreadId && user?.id && !hasLoadedMessages) {
      loadThreadMessages(currentThreadId);
    }
  }, [currentThreadId, user?.id, hasLoadedMessages]);

  const loadThreadMessages = async (threadId: string) => {
    if (!threadId || !user?.id) return;
    
    try {
      console.log(`Loading messages for thread ${threadId}`);
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      
      console.log(`Found ${data?.length || 0} messages for thread ${threadId}`);
      
      if (data && data.length > 0) {
        const formattedMessages = data.map((msg: DbChatMessage) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content,
          ...(msg.reference_entries && { references: msg.reference_entries }),
          ...(msg.analysis_data && { analysis: msg.analysis_data }),
          ...(msg.has_numeric_result !== undefined && { hasNumericResult: msg.has_numeric_result })
        })) as UIChatMessage[];
        
        setChatHistory(formattedMessages);
        setShowSuggestions(false);
      } else {
        setChatHistory([]);
        setShowSuggestions(true);
      }
      
      setHasLoadedMessages(true);
    } catch (error) {
      console.error("Error loading messages:", error);
      toast({
        title: "Error",
        description: "Unable to load conversation history",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const onThreadChange = (event: CustomEvent) => {
      if (event.detail.threadId) {
        setCurrentThreadId(event.detail.threadId);
        localStorage.setItem(THREAD_ID_STORAGE_KEY, event.detail.threadId);
        setHasLoadedMessages(false);
      }
    };
    
    window.addEventListener('threadSelected' as any, onThreadChange);
    window.addEventListener('newThreadCreated' as any, onThreadChange);
    
    return () => {
      window.removeEventListener('threadSelected' as any, onThreadChange);
      window.removeEventListener('newThreadCreated' as any, onThreadChange);
    };
  }, []);

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
        setNewThreadTitle(data.title);
      }
    } catch (error) {
      console.error("Error fetching thread title:", error);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const handleSendMessage = async (userMessage: string) => {
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
      queryText: userMessage,
      references: null,
      similarityScores: null,
      queryAnalysis: null,
      functionExecutions: null
    });
    
    addRagDiagnosticStep("Initializing chat request", "success", "Starting to process your query");
    
    let threadId = currentThreadId;
    if (!threadId) {
      try {
        addRagDiagnosticStep("Creating new thread", "loading");
        
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
        localStorage.setItem(THREAD_ID_STORAGE_KEY, newThreadId);
        
        window.dispatchEvent(
          new CustomEvent('newThreadCreated', { 
            detail: { threadId: newThreadId } 
          })
        );
      } catch (error) {
        console.error("Error creating thread:", error);
        addRagDiagnosticStep("Creating new thread", "error", error instanceof Error ? error.message : "Unknown error");
        toast({
          title: "Error",
          description: "Failed to create new conversation",
          variant: "destructive"
        });
        return;
      }
    }
    
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setShowSuggestions(false);
    
    addRagDiagnosticStep("Saving user message", "loading");
    
    try {
      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          content: userMessage,
          sender: 'user'
        });
        
      if (msgError) {
        addRagDiagnosticStep("Saving user message", "error", msgError.message);
        throw msgError;
      }
      
      addRagDiagnosticStep("Saving user message", "success");
      
      const queryTypes = analyzeQueryTypes(userMessage);
      
      addRagDiagnosticStep("Analyzing query intent", "loading");
      addRagDiagnosticStep("Analyzing query intent", "success", 
        `Detected: ${JSON.stringify({
          isEmotionFocused: queryTypes.isEmotionFocused,
          isQuantitative: queryTypes.isQuantitative,
          isWhyQuestion: queryTypes.isWhyQuestion,
          needsVectorSearch: queryTypes.needsVectorSearch
        })}`);
      
      if (queryTypes.isQuantitative && queryTypes.isEmotionFocused) {
        setProcessingStage("Analyzing your emotions and calculating results...");
      } else if (queryTypes.isWhyQuestion) {
        setProcessingStage("Analyzing your question and looking for explanations...");
      } else if (queryTypes.isEmotionFocused) {
        setProcessingStage("Analyzing emotion patterns in your journal...");
      } else {
        setProcessingStage("Analyzing your question...");
      }
      
      if (queryTypes.needsDataAggregation) {
        setProcessingStage("Aggregating data from your journal entries...");
      } else if (queryTypes.needsVectorSearch) {
        setProcessingStage("Searching for related entries in your journal...");
      }
      
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
        userMessage, 
        user.id, 
        queryTypes, 
        threadId, 
        true
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
      
      const uiResponse: UIChatMessage = {
        role: response.role === 'error' ? 'assistant' : response.role as 'user' | 'assistant',
        content: response.content,
        ...(response.references && { references: response.references }),
        ...(response.analysis && { analysis: response.analysis }),
        ...(response.diagnostics && { diagnostics: response.diagnostics }),
        ...(response.hasNumericResult !== undefined && { hasNumericResult: response.hasNumericResult })
      };
      
      addRagDiagnosticStep("Saving assistant response", "loading");
      
      await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          content: response.content,
          sender: 'assistant',
          reference_entries: response.references || null,
          has_numeric_result: response.hasNumericResult || false,
          analysis_data: response.analysis || null
        });
      
      addRagDiagnosticStep("Saving assistant response", "success");
      
      if (chatHistory.length === 0) {
        addRagDiagnosticStep("Updating thread title", "loading");
        
        const truncatedTitle = userMessage.length > 30 
          ? userMessage.substring(0, 30) + "..." 
          : userMessage;
          
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
      
      setChatHistory(prev => [...prev, uiResponse]);
    } catch (error: any) {
      console.error("Error sending message:", error);
      
      addRagDiagnosticStep("Processing error", "error", error?.message || "Unknown error");
      setRagDiagnostics(prev => ({
        ...prev,
        error: error?.message || "Unknown error"
      }));
      
      toast({
        title: "Error",
        description: "Failed to get a response. Please try again.",
        variant: "destructive"
      });
      
      setChatHistory(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: "I'm having trouble processing your request. Please try again later. " + 
                   (error?.message ? `Error: ${error.message}` : "")
        }
      ]);
    } finally {
      setIsLoading(false);
      setProcessingStage(null);
    }
  };

  const handleRenameThread = async () => {
    if (!currentThreadId || !newThreadTitle.trim()) return;
    
    try {
      const { error } = await supabase
        .from('chat_threads')
        .update({ 
          title: newThreadTitle,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentThreadId);
        
      if (error) throw error;
      
      setCurrentThreadTitle(newThreadTitle);
      setIsRenameDialogOpen(false);
      
      window.dispatchEvent(
        new CustomEvent('threadTitleUpdated', { 
          detail: { 
            threadId: currentThreadId, 
            title: newThreadTitle 
          } 
        })
      );
      
      toast({
        title: "Thread renamed",
        description: "The conversation has been renamed successfully.",
      });
    } catch (error) {
      console.error("Error renaming thread:", error);
      toast({
        title: "Error",
        description: "Failed to rename the conversation.",
        variant: "destructive"
      });
    }
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
      
      setChatHistory([]);
      setCurrentThreadId(null);
      localStorage.removeItem(THREAD_ID_STORAGE_KEY);
      setIsDeleteDialogOpen(false);
      setShowSuggestions(true);
      
      window.dispatchEvent(
        new CustomEvent('threadDeleted', { 
          detail: { threadId: currentThreadId } 
        })
      );
      
      toast({
        title: "Thread deleted",
        description: "The conversation has been deleted successfully.",
      });
      
      setTimeout(() => {
        fetchUserThreads();
      }, 100);
    } catch (error) {
      console.error("Error deleting thread:", error);
      toast({
        title: "Error",
        description: "Failed to delete the conversation.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="smart-chat-interface w-full h-full flex flex-col shadow-md border rounded-xl overflow-hidden bg-background">
      <CardHeader className="pb-2 flex flex-row items-center justify-between bg-muted/30 border-b sticky top-0 z-10">
        <div className="flex items-center">
          <h2 className="text-xl font-semibold">Roha</h2>
        </div>
        <div className="flex items-center gap-2">
          {chatHistory.length > 0 && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAnalysis(!showAnalysis)}
                className="flex items-center gap-1 text-sm"
              >
                <BarChart4 className="h-4 w-4" />
                {showAnalysis ? "Hide Analysis" : "Show Analysis"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRagDiagnostics(prev => ({ ...prev, isActive: !prev.isActive }))}
                className="flex items-center gap-1 text-sm"
              >
                <Brain className="h-4 w-4" />
                {ragDiagnostics.isActive ? "Hide Debug" : "Show Debug"}
              </Button>
              
              {currentThreadId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => {
                      setNewThreadTitle(currentThreadTitle);
                      setIsRenameDialogOpen(true);
                    }}>
                      <Pencil className="mr-2 h-4 w-4" />
                      <span>Rename</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive" 
                      onClick={() => setIsDeleteDialogOpen(true)}
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 flex flex-col">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col h-full">
            <div className="text-center max-w-lg mx-auto px-4">
              <h1 className="text-2xl md:text-3xl font-bold mb-3">How can I help you?</h1>
              <p className="text-muted-foreground mb-6">
                Hey, I am Roha, your personal AI assistant. You can ask me anything about your mental well-being and I will answer your queries basis your own journal insights.
              </p>
              
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto"
                >
                  {demoQuestions.map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="default"
                      className="px-4 py-3 h-auto flex items-center justify-start text-left bg-muted/50 hover:bg-muted"
                      onClick={() => handleSendMessage(question.text)}
                    >
                      {question.icon}
                      <span>{question.text}</span>
                    </Button>
                  ))}
                </motion.div>
              )}
            </div>
            <div className="flex-1"></div>
          </div>
        ) : (
          <>
            <div className="flex-grow space-y-4">
              {chatHistory.map((msg, idx) => (
                <ChatMessage 
                  key={idx} 
                  message={msg} 
                  showAnalysis={showAnalysis} 
                />
              ))}
            </div>
            
            {ragDiagnostics.isActive && ragDiagnostics.steps.length > 0 && ragDiagnostics.queryText && (
              <div className="mt-4">
                <ChatDiagnostics 
                  queryText={ragDiagnostics.queryText}
                  isVisible={ragDiagnostics.isActive}
                  ragSteps={ragDiagnostics.steps}
                  references={ragDiagnostics.references}
                  similarityScores={ragDiagnostics.similarityScores}
                  queryAnalysis={ragDiagnostics.queryAnalysis}
                  functionExecutions={ragDiagnostics.functionExecutions}
                />
              </div>
            )}
          </>
        )}
        
        {isLoading && (
          <div className="flex flex-col items-center justify-center space-y-2 p-4 rounded-lg bg-primary/5">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{processingStage || "Processing..."}</p>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </CardContent>
      
      <CardFooter className="border-t bg-muted/30 p-4 md:p-6">
        <ChatInput 
          onSendMessage={handleSendMessage} 
          isLoading={isLoading} 
          userId={user?.id}
        />
      </CardFooter>
      
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>
              Enter a new name for this conversation
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-y-2">
            <Input
              id="name"
              value={newThreadTitle}
              onChange={(e) => setNewThreadTitle(e.target.value)}
              placeholder="Conversation name"
              className="w-full"
            />
          </div>
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRenameDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleRenameThread}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
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
            <AlertDialogAction onClick={handleDeleteThread}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
