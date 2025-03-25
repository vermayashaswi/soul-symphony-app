
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { verifyUserAuthentication, getCurrentUserId } from '@/utils/audio/auth-utils';

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  created_at: string;
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
  
  const demoQuestions = [
    "How can I manage my anxiety better?",
    "What are some good journaling prompts for self-reflection?",
    "I've been feeling down lately. Any suggestions?",
    "How can I improve my mindfulness practice?",
    "What are some techniques to help with overthinking?"
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

      const formattedMessages: Message[] = data.map(msg => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender as 'user' | 'assistant',
        created_at: msg.created_at,
        thread_id: msg.thread_id
      }));

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
      console.log("Sending message to chat function with userId:", currentUserId);
      
      const threadTitle = isNewThread ? content.substring(0, 30) + (content.length > 30 ? "..." : "") : undefined;
      
      const { data, error } = await supabase.functions.invoke('chat-simple', {
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
      
      console.log("Received response from chat function:", data);
      
      if (isNewThread && data.threadId) {
        console.log("New thread created with ID:", data.threadId);
        onNewThreadCreated(data.threadId);
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || "I'm sorry, I couldn't process your request at the moment.",
        sender: 'assistant' as const,
        created_at: new Date().toISOString()
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
