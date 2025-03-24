import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Bot, Loader2, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { verifyUserAuthentication, getCurrentUserId } from '@/utils/audio/auth-utils';
import { ensureJournalEntriesHaveEmbeddings } from '@/utils/embeddings-utils';

export interface MessageReference {
  id: number;
  date: string;
  snippet: string;
  similarity?: number;
  type?: string;
}

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  created_at: string;
  reference_entries?: MessageReference[] | null;
  thread_id?: string;
}

interface ChatAreaProps {
  userId: string | undefined;
  threadId: string | null;
  onNewThreadCreated: (threadId: string) => void;
}

export default function ChatArea({ userId, threadId, onNewThreadCreated }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [hasJournalEntries, setHasJournalEntries] = useState<boolean | null>(null);
  
  const demoQuestions = [
    "How can I manage my anxiety better?",
    "What are some good journaling prompts for self-reflection?",
    "I've been feeling down lately. Any suggestions?",
    "How can I improve my mindfulness practice?",
    "What are some techniques to help with overthinking?"
  ];

  useEffect(() => {
    if (userId) {
      checkForJournalEntries(userId);
    } else {
      getCurrentUserId().then(id => {
        if (id) {
          checkForJournalEntries(id);
        }
      });
    }
  }, [userId]);

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
      const welcomeMessage = hasJournalEntries === false
        ? "Hi, I'm Feelosophy, your AI assistant. I noticed you don't have any journal entries yet. To get personalized insights, try creating some journal entries first. How can I help you today?"
        : "Hi, I'm Feelosophy, your AI assistant. I'm here to help you reflect on your thoughts and feelings. How are you doing today?";
        
      setMessages([
        {
          id: '1',
          content: welcomeMessage,
          sender: 'assistant',
          created_at: new Date().toISOString(),
        }
      ]);
    }
  }, [messages.length, threadId, hasJournalEntries]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const checkForJournalEntries = async (userId: string) => {
    try {
      console.log('Checking for journal entries for user ID:', userId);
      
      const { count, error } = await supabase
        .from('Journal Entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
        
      if (error) {
        console.error('Error checking journal entries:', error);
        return;
      }
      
      if (count > 0) {
        await ensureJournalEntriesHaveEmbeddings(userId);
      }
      
      setHasJournalEntries(count > 0);
      console.log(`User has ${count} journal entries`);
    } catch (error) {
      console.error('Error:', error);
    }
  };

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

      const formattedMessages: Message[] = data.map(msg => {
        let references: MessageReference[] | null = null;
        
        if (msg.reference_entries && Array.isArray(msg.reference_entries)) {
          references = msg.reference_entries.map(ref => {
            if (typeof ref === 'object' && ref !== null &&
                'id' in ref && 'date' in ref && 'snippet' in ref) {
              return {
                id: Number(ref.id),
                date: String(ref.date),
                snippet: String(ref.snippet),
                similarity: 'similarity' in ref ? Number(ref.similarity) : undefined,
                type: 'type' in ref ? String(ref.type) : undefined
              };
            }
            return {
              id: 0,
              date: new Date().toISOString(),
              snippet: 'Invalid reference entry'
            };
          });
        }
        
        return {
          id: msg.id,
          content: msg.content,
          sender: msg.sender as 'user' | 'assistant',
          created_at: msg.created_at,
          reference_entries: references,
          thread_id: msg.thread_id
        };
      });

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async (content: string = inputValue) => {
    if (!content.trim()) {
      toast.error('Please enter a message');
      return;
    }
    
    let currentUserId = userId;
    if (!currentUserId) {
      const authCheck = await verifyUserAuthentication();
      if (!authCheck.isAuthenticated) {
        toast.error(authCheck.error || 'You must be signed in to use the chat');
        return;
      }
      currentUserId = authCheck.userId;
    }
    
    if (!currentUserId) {
      toast.error('User ID not found');
      return;
    }
    
    const embeddingsResult = await ensureJournalEntriesHaveEmbeddings(currentUserId);
    console.log('Embeddings generation result:', embeddingsResult);
    
    if (!embeddingsResult) {
      console.warn('Failed to ensure all journal entries have embeddings');
    }
    
    const isNewThread = !threadId;
    
    const tempUserMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      sender: 'user' as const,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempUserMessage]);
    setInputValue('');
    setIsLoading(true);
    setShowWelcome(false);
    
    try {
      console.log("Sending message to chat-with-rag function with userId:", currentUserId);
      
      const threadTitle = isNewThread ? content.substring(0, 30) + (content.length > 30 ? "..." : "") : undefined;
      
      const { data, error } = await supabase.functions.invoke('chat-with-rag', {
        body: { 
          message: content.trim(),
          userId: currentUserId,
          threadId: threadId,
          isNewThread: isNewThread,
          threadTitle: threadTitle
        }
      });
      
      if (error) {
        console.error('Error calling chat function:', error);
        toast.error('Failed to get a response. Please try again.');
        setIsLoading(false);
        return;
      }
      
      console.log("Received response from chat-with-rag function:", data);
      
      if (data.journal_entries_count === 0) {
        const { count } = await supabase
          .from('Journal Entries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUserId);
          
        if (count > 0) {
          console.warn('Journal entries exist but RAG function could not access them.');
          toast.warning('Your entries exist but could not be accessed. Trying to fix the issue...');
          await ensureJournalEntriesHaveEmbeddings(currentUserId);
        }
      }
      
      if (isNewThread && data.threadId) {
        console.log("New thread created with ID:", data.threadId);
        onNewThreadCreated(data.threadId);
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || "I'm sorry, I couldn't process your request at the moment.",
        sender: 'assistant' as const,
        created_at: new Date().toISOString(),
        reference_entries: data.references
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error in chat:', err);
      toast.error('Something went wrong. Please try again later.');
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

  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full">
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
                            <TooltipContent className="w-64 p-2">
                              <p className="font-medium mb-1">Referenced journal entries:</p>
                              <ul className="space-y-1">
                                {message.reference_entries.map((ref, idx) => (
                                  <li key={idx} className="text-xs">
                                    <span className="font-medium">{format(new Date(ref.date), 'MMM d, yyyy')}:</span>{' '}
                                    {ref.snippet}
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
      
      {hasJournalEntries === false && !isLoadingMessages && (
        <div className="mb-4 mx-4">
          <Card className="bg-amber-50 border-amber-200">
            <div className="p-3 text-sm text-amber-800">
              <p className="font-medium">No Journal Entries Found</p>
              <p className="mt-1">To get personalized insights, please add some journal entries first. This will help me provide more relevant advice based on your experiences.</p>
            </div>
          </Card>
        </div>
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
