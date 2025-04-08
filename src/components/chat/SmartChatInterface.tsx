import React, { useState, useEffect, useRef } from "react";
import ChatInput from "./ChatInput";
import ChatArea from "./ChatArea";
import { Button } from "@/components/ui/button";
import { processChatMessage } from "@/services/chatService";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import EmptyChatState from "./EmptyChatState";
import VoiceRecordingButton from "./VoiceRecordingButton";
import { Trash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { ChatMessage } from "@/services/chat";
import { getThreadMessages, saveMessage } from "@/services/chat";

// Keep track of ongoing message processing across navigation
const ongoingProcessingMap = new Map();

const SmartChatInterface = () => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const loadedThreadRef = useRef<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const onThreadChange = (event: CustomEvent) => {
      if (event.detail.threadId) {
        setCurrentThreadId(event.detail.threadId);
        loadThreadMessages(event.detail.threadId);
        console.log(`Thread selected: ${event.detail.threadId}`);
      }
    };
    
    window.addEventListener('threadSelected' as any, onThreadChange);
    
    const storedThreadId = localStorage.getItem("lastActiveChatThreadId");
    if (storedThreadId && user?.id) {
      setCurrentThreadId(storedThreadId);
      loadThreadMessages(storedThreadId);
      console.log(`Loading stored thread: ${storedThreadId}`);
    } else {
      setInitialLoading(false);
      console.log("No stored thread found, showing empty state");
    }
    
    // Check for ongoing processing
    if (user?.id) {
      const userProcessing = ongoingProcessingMap.get(user.id);
      if (userProcessing && userProcessing.threadId) {
        loadThreadMessages(userProcessing.threadId);
      }
    }
    
    return () => {
      window.removeEventListener('threadSelected' as any, onThreadChange);
    };
  }, [user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, loading]);

  const scrollToBottom = () => {
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const loadThreadMessages = async (threadId: string) => {
    if (!threadId || !user?.id) {
      setInitialLoading(false);
      return;
    }
    
    if (loadedThreadRef.current === threadId) {
      console.log(`Thread ${threadId} already loaded, skipping`);
      return;
    }
    
    setInitialLoading(true);
    console.log(`Loading messages for thread ${threadId}`);
    
    try {
      const { data: threadData, error: threadError } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('id', threadId)
        .eq('user_id', user.id)
        .single();
        
      if (threadError || !threadData) {
        console.error("Thread not found or doesn't belong to user:", threadError);
        setChatHistory([]);
        setShowSuggestions(true);
        setInitialLoading(false);
        return;
      }
      
      console.log(`Thread ${threadId} found, fetching messages`);
      const messages = await getThreadMessages(threadId);
      
      if (messages && messages.length > 0) {
        console.log(`Loaded ${messages.length} messages for thread ${threadId}`);
        setChatHistory(messages);
        setShowSuggestions(false);
        loadedThreadRef.current = threadId;
      } else {
        console.log(`No messages found for thread ${threadId}`);
        setChatHistory([]);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      toast({
        title: "Error loading messages",
        description: "Could not load conversation history.",
        variant: "destructive"
      });
      setChatHistory([]);
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

    let threadId = currentThreadId;
    
    if (!threadId) {
      toast({
        title: "No conversation selected",
        description: "Please select a conversation or start a new one.",
        variant: "destructive"
      });
      return;
    }
    
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      thread_id: threadId,
      content: message,
      sender: 'user',
      role: 'user',
      created_at: new Date().toISOString()
    };
    
    console.log(`Adding temporary message to UI: ${tempUserMessage.id}`);
    setChatHistory(prev => [...prev, tempUserMessage]);
    setLoading(true);
    setProcessingStage("Analyzing your question...");
    
    // Store the processing information so we can track it across navigations
    const processingInfo = {
      userId: user.id,
      threadId: threadId,
      messageId: tempUserMessage.id,
      message: message,
      timestamp: Date.now()
    };
    
    ongoingProcessingMap.set(user.id, processingInfo);
    
    // Create the actual processing function that will run even if component unmounts
    const processMessageInBackground = async () => {
      try {
        let savedUserMessage: ChatMessage | null = null;
        try {
          console.log(`Saving user message to thread ${threadId}`);
          savedUserMessage = await saveMessage(threadId, message, 'user');
          console.log("User message saved with ID:", savedUserMessage?.id);
          
          if (savedUserMessage && isMountedRef.current) {
            console.log(`Replacing temporary message with saved message: ${savedUserMessage.id}`);
            setChatHistory(prev => prev.map(msg => 
              msg.id === tempUserMessage.id ? savedUserMessage! : msg
            ));
          } else if (!savedUserMessage) {
            console.error("Failed to save user message - null response");
            throw new Error("Failed to save message");
          }
        } catch (saveError: any) {
          console.error("Error saving user message:", saveError);
          if (isMountedRef.current) {
            toast({
              title: "Error saving message",
              description: saveError.message || "Could not save your message",
              variant: "destructive"
            });
          }
        }
        
        console.log(`Analyzing query: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`);
        console.log("Performing comprehensive query analysis for:", message);
        if (isMountedRef.current) {
          setProcessingStage("Analyzing patterns in your journal...");
        }
        const queryTypes = analyzeQueryTypes(message);
        
        const analysisDetails = {
          isEmotionFocused: queryTypes.isEmotionFocused,
          isQuantitative: queryTypes.isQuantitative,
          isWhyQuestion: queryTypes.isWhyQuestion,
          isTemporalQuery: queryTypes.isTemporalQuery,
          timeRange: queryTypes.timeRange.periodName,
          emotion: queryTypes.emotion || 'none detected'
        };
        
        console.log("Query analysis result:", queryTypes);
        
        if (isMountedRef.current) {
          setProcessingStage("Searching for insights...");
        }
        console.log("Sending query to AI for processing");
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
        
        console.log("Response received:", responseInfo);
        
        try {
          console.log("Saving assistant response to database");
          const savedResponse = await saveMessage(
            threadId,
            response.content,
            'assistant',
            response.references,
            response.analysis,
            response.hasNumericResult
          );
          
          console.log("Assistant response saved with ID:", savedResponse?.id);
          
          if (savedResponse && isMountedRef.current) {
            console.log("Adding assistant response to chat history");
            setChatHistory(prev => [...prev, savedResponse]);
          } else if (!savedResponse) {
            throw new Error("Failed to save assistant response");
          }
        } catch (saveError: any) {
          console.error("Error saving assistant response:", saveError);
          const assistantMessage: ChatMessage = {
            id: `temp-response-${Date.now()}`,
            thread_id: threadId,
            content: response.content,
            sender: 'assistant',
            role: 'assistant',
            created_at: new Date().toISOString(),
            reference_entries: response.references,
            analysis_data: response.analysis,
            has_numeric_result: response.hasNumericResult
          };
          
          console.log("Adding fallback temporary assistant response to chat history");
          if (isMountedRef.current) {
            setChatHistory(prev => [...prev, assistantMessage]);
            console.error("Failed to save assistant response to database, using temporary message");
            
            toast({
              title: "Warning",
              description: "Response displayed but couldn't be saved to your conversation history",
              variant: "default"
            });
          }
        }
      } catch (error: any) {
        console.error("Error sending message:", error);
        
        const errorContent = "I'm having trouble processing your request. Please try again later. " + 
                (error?.message ? `Error: ${error.message}` : "");
        
        try {
          console.log("Saving error message to database");
          const savedErrorMessage = await saveMessage(
            threadId,
            errorContent,
            'assistant'
          );
          
          if (savedErrorMessage && isMountedRef.current) {
            console.log("Adding error message to chat history");
            setChatHistory(prev => [...prev, savedErrorMessage]);
          } else if (!savedErrorMessage) {
            const errorMessage: ChatMessage = {
              id: `error-${Date.now()}`,
              thread_id: threadId,
              content: errorContent,
              sender: 'assistant',
              role: 'assistant',
              created_at: new Date().toISOString()
            };
            
            if (isMountedRef.current) {
              console.log("Adding fallback error message to chat history");
              setChatHistory(prev => [...prev, errorMessage]);
            }
          }
          
          console.log("Error message saved to database");
        } catch (e) {
          console.error("Failed to save error message:", e);
          
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            thread_id: threadId,
            content: errorContent,
            sender: 'assistant',
            role: 'assistant',
            created_at: new Date().toISOString()
          };
          
          if (isMountedRef.current) {
            console.log("Adding last-resort error message to chat history");
            setChatHistory(prev => [...prev, errorMessage]);
          }
        }
      } finally {
        // Remove this processing task from the map
        ongoingProcessingMap.delete(user.id);
        
        if (isMountedRef.current) {
          setLoading(false);
          setProcessingStage(null);
        }
      }
    };
    
    // Start processing in the background
    processMessageInBackground();
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
        console.error("[Desktop] Error deleting messages:", messagesError);
        throw messagesError;
      }
      
      const { error: threadError } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', currentThreadId);
        
      if (threadError) {
        console.error("[Desktop] Error deleting thread:", threadError);
        throw threadError;
      }
      
      setChatHistory([]);
      setShowSuggestions(true);
      loadedThreadRef.current = null;
      
      const { data } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);
        
      if (data && data.length > 0) {
        setCurrentThreadId(data[0].id);
        loadThreadMessages(data[0].id);
        
        window.dispatchEvent(
          new CustomEvent('threadSelected', { 
            detail: { threadId: data[0].id } 
          })
        );
      } else {
        const { data: newThread, error } = await supabase
          .from('chat_threads')
          .insert({
            user_id: user.id,
            title: "New Conversation",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (!error && newThread) {
          setCurrentThreadId(newThread.id);
          
          window.dispatchEvent(
            new CustomEvent('threadSelected', { 
              detail: { threadId: newThread.id } 
            })
          );
        }
      }
      
      toast({
        title: "Success",
        description: "Conversation deleted successfully",
      });
      
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("[Desktop] Error deleting thread:", error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="chat-interface flex flex-col h-full">
      <div className="chat-header flex items-center justify-between py-3 px-4 border-b">
        <h2 className="text-xl font-semibold">Rūḥ</h2>
        
        <div className="flex items-center gap-2">
          {currentThreadId && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 text-muted-foreground hover:text-destructive" 
              onClick={() => setShowDeleteDialog(true)}
              title="Delete current conversation"
            >
              <Trash className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
      
      <div className="chat-content flex-1 overflow-hidden">
        {initialLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="ml-2 text-muted-foreground">Loading conversation...</span>
          </div>
        ) : chatHistory.length === 0 ? (
          <EmptyChatState />
        ) : (
          <ChatArea 
            chatMessages={chatHistory}
            isLoading={loading}
            processingStage={processingStage || undefined}
          />
        )}
      </div>
      
      <div className="chat-input-container bg-white border-t p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <ChatInput 
              onSendMessage={handleSendMessage} 
              isLoading={loading} 
              userId={user?.id}
            />
          </div>
          <VoiceRecordingButton 
            isLoading={loading}
            isRecording={false}
            recordingTime={0}
            onStartRecording={() => {}}
            onStopRecording={() => {}}
          />
        </div>
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
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default function SmartChatInterfaceWrapper() {
  return <SmartChatInterface />;
}
