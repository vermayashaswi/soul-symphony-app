
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Bot, Loader2, Brain, BrainCircuit, CalendarDays, HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ChatDiagnostics from './ChatDiagnostics';

export interface MessageReference {
  id: number;
  date: string;
  snippet: string;
  similarity?: number;
  type?: string;
  emotions?: Record<string, number> | null;
}

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  created_at: string;
  reference_entries?: MessageReference[] | null;
}

interface ChatAreaProps {
  userId: string | undefined;
  threadId: string | null;
  onNewThreadCreated: (threadId: string) => void;
}

interface DiagnosticsStep {
  id: number;
  step: string;
  status: 'pending' | 'success' | 'error' | 'loading';
  details?: string;
  timestamp?: string;
}

interface QueryAnalysis {
  queryType: 'emotional' | 'temporal' | 'general';
  emotion: string | null;
  timeframe: {
    timeType: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  isWhenQuestion: boolean;
}

export default function ChatArea({ userId, threadId, onNewThreadCreated }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [ragSteps, setRagSteps] = useState<DiagnosticsStep[]>([
    { id: 1, step: "Query Embedding Generation", status: 'pending' },
    { id: 2, step: "Vector Similarity Search", status: 'pending' },
    { id: 3, step: "Context Construction", status: 'pending' },
    { id: 4, step: "LLM Response Generation", status: 'pending' },
  ]);
  const [similarityScores, setSimilarityScores] = useState<{id: number, score: number}[] | null>(null);
  const [currentQuery, setCurrentQuery] = useState("");
  const [queryAnalysis, setQueryAnalysis] = useState<QueryAnalysis | null>(null);

  const demoQuestions = [
    "How can I manage my anxiety better?",
    "What are some good journaling prompts for self-reflection?",
    "I've been feeling down lately. Any suggestions?",
    "When was I most sad in the last week?",
    "What made me happiest yesterday?"
  ];

  useEffect(() => {
    if (threadId) {
      fetchMessages(threadId);
      setShowWelcome(false);
    } else {
      setMessages([]);
      setShowWelcome(true);
    }
  }, [threadId]);

  useEffect(() => {
    if (messages.length === 0 && threadId === null) {
      setMessages([
        {
          id: '1',
          content: "Hi, I'm Feelosophy, your AI assistant. I'm here to help you reflect on your thoughts and feelings. How are you doing today?",
          sender: 'assistant',
          created_at: new Date().toISOString(),
        }
      ]);
    }
  }, [messages.length, threadId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchMessages = async (threadId: string) => {
    try {
      setIsLoadingMessages(true);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        toast.error('Failed to load chat history');
        return;
      }

      const typedMessages: Message[] = data?.map(msg => {
        let processedRefs: MessageReference[] | null = null;
        
        if (msg.reference_entries) {
          if (Array.isArray(msg.reference_entries)) {
            processedRefs = msg.reference_entries.map((ref: any) => ({
              id: ref.id || 0,
              date: ref.date || '',
              snippet: ref.snippet || '',
              similarity: ref.similarity,
              type: ref.type,
              emotions: ref.emotions
            }));
          } else if (typeof msg.reference_entries === 'object') {
            processedRefs = [{
              id: (msg.reference_entries as any).id || 0,
              date: (msg.reference_entries as any).date || '',
              snippet: (msg.reference_entries as any).snippet || '',
              similarity: (msg.reference_entries as any).similarity,
              type: (msg.reference_entries as any).type,
              emotions: (msg.reference_entries as any).emotions
            }];
          }
        }
        
        return {
          ...msg,
          sender: msg.sender === 'user' ? 'user' : 'assistant' as 'user' | 'assistant',
          reference_entries: processedRefs
        };
      }) || [];

      setMessages(typedMessages);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const resetRagSteps = () => {
    setRagSteps([
      { id: 1, step: "Query Embedding Generation", status: 'pending' },
      { id: 2, step: "Vector Similarity Search", status: 'pending' },
      { id: 3, step: "Context Construction", status: 'pending' },
      { id: 4, step: "LLM Response Generation", status: 'pending' },
    ]);
    setSimilarityScores(null);
    setQueryAnalysis(null);
  };

  const updateRagStep = (id: number, status: 'pending' | 'success' | 'error' | 'loading', details?: string) => {
    setRagSteps(prev => 
      prev.map(step => 
        step.id === id 
          ? { 
              ...step, 
              status, 
              details, 
              timestamp: new Date().toLocaleTimeString() 
            } 
          : step
      )
    );
  };

  const detectTimeframe = (text: string): string | null => {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('last week') || lowerText.includes('this week') || 
        lowerText.includes('past week') || lowerText.includes('recent days')) {
      return 'week';
    } else if (lowerText.includes('last month') || lowerText.includes('this month') || 
               lowerText.includes('past month') || lowerText.includes('recent weeks')) {
      return 'month';
    } else if (lowerText.includes('last year') || lowerText.includes('this year') || 
               lowerText.includes('past year')) {
      return 'year';
    } else if (lowerText.includes('yesterday') || lowerText.includes('today')) {
      return 'day';
    }
    
    return null;
  };

  const handleSendMessage = async (content: string = inputValue) => {
    if (!content.trim() || !userId) return;
    
    const isNewThread = !threadId;
    setCurrentQuery(content.trim());
    resetRagSteps();
    
    const tempUserMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      sender: 'user',
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempUserMessage]);
    setInputValue('');
    setIsLoading(true);
    setShowWelcome(false);
    setShowDiagnostics(true);
    
    const timeframe = detectTimeframe(content);
    
    try {
      updateRagStep(1, 'loading', 'Generating embedding for query...');
      
      console.log("Sending message to chat-with-rag function");
      
      const { data, error } = await supabase.functions.invoke('chat-with-rag', {
        body: { 
          message: content.trim(),
          userId: userId,
          threadId: threadId,
          isNewThread: isNewThread,
          threadTitle: content.substring(0, 30) + (content.length > 30 ? "..." : ""),
          includeDiagnostics: true,
          timeframe: timeframe
        }
      });
      
      if (error) {
        console.error('Error calling chat function:', error);
        toast.error('Failed to get a response. Please try again.');
        updateRagStep(1, 'error', 'Failed to generate embedding: API error');
        setIsLoading(false);
        return;
      }
      
      console.log("Received response from chat-with-rag function:", data);
      
      if (data.queryAnalysis) {
        setQueryAnalysis(data.queryAnalysis);
        updateRagStep(1, 'success', `Query classified as ${data.queryAnalysis.queryType}` + 
          (data.queryAnalysis.emotion ? ` related to '${data.queryAnalysis.emotion}'` : ''));
      }
      
      if (data.diagnostics) {
        if (data.diagnostics.embeddingGenerated) {
          if (!data.queryAnalysis) {
            updateRagStep(1, 'success', 'Embedding generated successfully');
          }
        } else {
          updateRagStep(1, 'error', data.diagnostics.embeddingError || 'Failed to generate embedding');
        }
        
        if (data.diagnostics.similaritySearchComplete) {
          updateRagStep(2, 'success', 
            `Found ${data.references?.length || 0} relevant entries`);
          
          if (data.diagnostics.similarityScores || data.similarityScores) {
            setSimilarityScores(data.diagnostics.similarityScores || data.similarityScores);
          }
        } else {
          updateRagStep(2, 'error', data.diagnostics.searchError || 'Failed to perform similarity search');
        }
        
        if (data.diagnostics.contextBuilt) {
          updateRagStep(3, 'success', 
            `Built context with ${data.diagnostics.contextSize || 0} characters`);
        } else {
          updateRagStep(3, 'error', data.diagnostics.contextError || 'Failed to build context');
        }
        
        if (data.response) {
          updateRagStep(4, 'success', `Generated response with ${data.diagnostics.tokenCount || 'unknown'} tokens`);
        } else {
          updateRagStep(4, 'error', data.diagnostics.llmError || 'Failed to generate response');
        }
      }
      
      if (isNewThread && data.threadId) {
        onNewThreadCreated(data.threadId);
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || "I'm sorry, I couldn't process your request at the moment.",
        sender: 'assistant',
        created_at: new Date().toISOString(),
        reference_entries: data.references
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error in chat:', err);
      toast.error('Something went wrong. Please try again later.');
      ragSteps.forEach(step => {
        if (step.status === 'pending' || step.status === 'loading') {
          updateRagStep(step.id, 'error', 'Process failed');
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Function to render a badge for the query type
  const renderQueryTypeBadge = () => {
    if (!queryAnalysis) return null;
    
    let icon = null;
    let label = "";
    let className = "flex items-center gap-1 text-xs px-2 py-1 rounded-full";
    
    if (queryAnalysis.queryType === 'emotional') {
      icon = <HeartPulse className="h-3 w-3" />;
      label = `Emotional Query: ${queryAnalysis.emotion || ''}`;
      className += " bg-pink-100 text-pink-800";
    } else if (queryAnalysis.queryType === 'temporal') {
      icon = <CalendarDays className="h-3 w-3" />;
      label = `Time-based Query: ${queryAnalysis.timeframe.timeType || ''}`;
      className += " bg-blue-100 text-blue-800";
    } else {
      icon = <BrainCircuit className="h-3 w-3" />;
      label = "General Query";
      className += " bg-gray-100 text-gray-800";
    }
    
    return (
      <div className={className}>
        {icon}
        <span>{label}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between px-4 pt-2 items-center">
        {queryAnalysis && renderQueryTypeBadge()}
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="flex items-center gap-1 text-xs"
        >
          <BrainCircuit className="h-3 w-3" />
          {showDiagnostics ? "Hide Diagnostics" : "Show Diagnostics"}
        </Button>
      </div>
      
      <div className="flex flex-col space-y-4 mb-4 flex-1 overflow-y-auto px-4 py-4">
        {isLoadingMessages ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex",
                  message.sender === 'user' ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  "flex gap-3 max-w-[85%]",
                  message.sender === 'user' ? "flex-row-reverse" : "flex-row"
                )}>
                  <Avatar className={cn(
                    "h-8 w-8",
                    message.sender === 'assistant' && "bg-primary text-primary-foreground"
                  )}>
                    {message.sender === 'assistant' ? (
                      <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
                    ) : (
                      <AvatarFallback>U</AvatarFallback>
                    )}
                  </Avatar>
                  
                  <div className="space-y-1">
                    <Card className={cn(
                      "p-3 text-sm",
                      message.sender === 'user' 
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </Card>
                    
                    {message.reference_entries && message.reference_entries.length > 0 && (
                      <div className="flex items-center text-xs text-muted-foreground">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center cursor-help">
                                <Brain className="h-3 w-3 mr-1" />
                                <span>Based on {message.reference_entries.length} journal entries</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="w-80 p-3">
                              <p className="font-medium mb-2">Referenced journal entries:</p>
                              <ul className="space-y-2 max-h-60 overflow-y-auto">
                                {message.reference_entries.map((ref, idx) => (
                                  <li key={idx} className="text-xs border-l-2 border-primary pl-2 py-1">
                                    <div className="font-medium">{format(new Date(ref.date), 'MMM d, yyyy h:mm a')}</div>
                                    <div>{ref.snippet}</div>
                                    {ref.emotions && Object.keys(ref.emotions).length > 0 && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {Object.entries(ref.emotions)
                                          .sort(([, a], [, b]) => b - a)
                                          .slice(0, 3)
                                          .map(([emotion, score]) => (
                                            <span key={emotion} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                                              {emotion}: {Math.round(score * 100)}%
                                            </span>
                                          ))
                                        }
                                      </div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[85%]">
                  <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                    <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                  <Card className="p-3 bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </Card>
                </div>
              </div>
            )}
          </>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {showDiagnostics && (
        <ChatDiagnostics 
          queryText={currentQuery}
          isVisible={showDiagnostics}
          ragSteps={ragSteps}
          references={messages.length > 0 ? 
            messages[messages.length - 1].reference_entries : null}
          similarityScores={similarityScores}
          queryAnalysis={queryAnalysis}
        />
      )}
      
      <AnimatePresence>
        {showWelcome && messages.length <= 2 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 px-4"
          >
            <div className="text-center mb-4">
              <h3 className="text-lg font-medium">Try asking about:</h3>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {demoQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="text-sm"
                  onClick={() => handleSendMessage(question)}
                >
                  {question}
                </Button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="flex gap-2 items-end p-4 border-t">
        <Textarea
          placeholder="Type your message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="resize-none min-h-[60px]"
          rows={1}
        />
        <Button 
          onClick={() => handleSendMessage()} 
          size="icon"
          disabled={isLoading || !inputValue.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
