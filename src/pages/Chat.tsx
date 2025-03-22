
import { useState, useRef, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Message = {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
};

// Demo questions to show to new users
const demoQuestions = [
  "How can I manage my anxiety better?",
  "What are some good journaling prompts for self-reflection?",
  "I've been feeling down lately. Any suggestions?",
  "How can I improve my mindfulness practice?",
  "What are some techniques to help with overthinking?"
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  
  // Add initial assistant message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: '1',
          content: "Hi, I'm Feelosophy, your AI assistant. I'm here to help you reflect on your thoughts and feelings. How are you doing today?",
          sender: 'assistant',
          timestamp: new Date()
        }
      ]);
    }
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (content: string = inputValue) => {
    if (!content.trim()) return;
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setShowWelcome(false);
    
    try {
      // Call the chat-rag edge function
      const { data, error } = await supabase.functions.invoke('chat-rag', {
        body: { message: content.trim() }
      });
      
      if (error) {
        console.error('Error calling chat function:', error);
        toast.error('Failed to get a response. Please try again.');
        setIsLoading(false);
        return;
      }
      
      // Add assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || "I'm sorry, I couldn't process your request at the moment.",
        sender: 'assistant',
        timestamp: new Date()
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
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      <ParticleBackground />
      
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 pt-24 pb-6">
        <div className="flex flex-col space-y-4 mb-4 flex-1 overflow-y-auto">
          
          {/* Chat messages */}
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
                
                <Card className={cn(
                  "p-3 text-sm",
                  message.sender === 'user' 
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </Card>
              </div>
            </motion.div>
          ))}
          
          {/* Loading indicator */}
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
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Sample questions */}
        <AnimatePresence>
          {showWelcome && messages.length <= 2 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
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
        
        {/* Input area */}
        <div className="flex gap-2 items-end">
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
    </div>
  );
}
