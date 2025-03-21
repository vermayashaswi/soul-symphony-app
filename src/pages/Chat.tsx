
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Send, Mic, MicOff, Bot, User, Image, Calendar, PlusCircle, SmilePlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Message = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  isThinking?: boolean;
  imageUrl?: string;
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: "Hello! I'm your AI mental health assistant. How are you feeling today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Sample suggestions for quick responses
  const suggestions = [
    'How have I been feeling lately?',
    'What patterns do you see in my emotions?',
    'Give me a mindfulness exercise',
    'Help me process my anxiety',
    'Tell me about my progress',
  ];

  useEffect(() => {
    // Scroll to the bottom of messages when messages change
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: input,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    // Simulate AI thinking
    const thinkingId = (Date.now() + 1).toString();
    setMessages(prev => [
      ...prev, 
      { 
        id: thinkingId, 
        sender: 'ai', 
        text: '...', 
        timestamp: new Date(),
        isThinking: true,
      }
    ]);
    
    // Simulate AI response after a short delay
    setTimeout(() => {
      setMessages(prev => prev.filter(msg => msg.id !== thinkingId));
      
      const aiResponse: Message = {
        id: (Date.now() + 2).toString(),
        sender: 'ai',
        text: getAIResponse(input),
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiResponse]);
    }, 1500);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        // In a real app, this would send audio to Whisper API
        // Here we just simulate a text response
        processVoiceToText();
        
        // Stop audio tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
      toast.success('Recording started');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoiceToText = () => {
    // This would normally send audio to Whisper API and get a transcript
    // Here we just simulate it with a fixed response
    const simulatedText = "I've been feeling a bit anxious about work lately.";
    
    // Add user message with the transcribed text
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: simulatedText,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Simulate AI thinking
    const thinkingId = (Date.now() + 1).toString();
    setMessages(prev => [
      ...prev, 
      { 
        id: thinkingId, 
        sender: 'ai', 
        text: '...', 
        timestamp: new Date(),
        isThinking: true,
      }
    ]);
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => prev.filter(msg => msg.id !== thinkingId));
      
      const aiResponse: Message = {
        id: (Date.now() + 2).toString(),
        sender: 'ai',
        text: "I've noticed that work-related anxiety has been a recurring theme in your entries. Would you like to explore some coping strategies that have helped others in similar situations?",
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiResponse]);
    }, 1500);
  };

  // Simple function to simulate AI responses
  const getAIResponse = (userMessage: string) => {
    const lowerCaseMsg = userMessage.toLowerCase();
    
    if (lowerCaseMsg.includes('how') && lowerCaseMsg.includes('feeling')) {
      return "Based on your recent journal entries, you've been experiencing more joy in the past week, with a 20% decrease in anxiety compared to the previous week. Your energy levels have been relatively stable.";
    }
    
    if (lowerCaseMsg.includes('pattern') || lowerCaseMsg.includes('trend')) {
      return "I've noticed that you tend to feel more anxious on Mondays and Tuesdays, but your mood typically improves toward the end of the week. Your sleep quality seems to significantly impact your daily mood - days after good sleep show more positive emotions.";
    }
    
    if (lowerCaseMsg.includes('mindful') || lowerCaseMsg.includes('exercise')) {
      return "Here's a simple mindfulness exercise: Close your eyes and take five deep, slow breaths. Focus on the sensation of breathing in and out. Notice any thoughts that come up without judgment, and gently return your attention to your breath. How does that feel?";
    }
    
    if (lowerCaseMsg.includes('anxiety') || lowerCaseMsg.includes('stress')) {
      return "I'm sorry to hear you're experiencing anxiety. Your journal entries suggest that taking a short walk outside tends to help you when you're feeling anxious. Would you like me to suggest some other anxiety-reduction techniques that might work for you?";
    }
    
    if (lowerCaseMsg.includes('progress')) {
      return "You've made significant progress in the past month! Your anxiety levels have decreased by 15%, and you've had 8 consecutive days of journaling - your longest streak yet. Your emotional vocabulary has also expanded, allowing you to express your feelings with more nuance.";
    }
    
    // Default response
    return "Thank you for sharing that with me. Would you like to explore this topic further, or would you prefer to talk about something else? I'm here to support you however I can.";
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 pt-28 pb-20">
        <div className="mb-4">
          <h1 className="text-3xl font-bold mb-2">AI Assistant</h1>
          <p className="text-muted-foreground">Chat with your personal mental health companion</p>
        </div>
        
        <div className="flex-1 flex flex-col bg-secondary/50 rounded-xl overflow-hidden border border-border">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "flex",
                    message.sender === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  <div 
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-3",
                      message.sender === 'user' 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-white text-foreground rounded-tl-none"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {message.sender === 'ai' ? (
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                          <User className="h-3.5 w-3.5 text-white" />
                        </div>
                      )}
                      <span className={cn(
                        "text-xs",
                        message.sender === 'user' ? "text-white/70" : "text-muted-foreground"
                      )}>
                        {message.sender === 'ai' ? 'Feelosophy' : 'You'} • {format(message.timestamp, 'h:mm a')}
                      </span>
                    </div>
                    
                    {message.isThinking ? (
                      <div className="flex gap-1 py-1">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse"></div>
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    ) : (
                      <p className={cn(
                        message.sender === 'user' ? "text-white" : "text-foreground"
                      )}>
                        {message.text}
                      </p>
                    )}
                    
                    {message.imageUrl && (
                      <img 
                        src={message.imageUrl} 
                        alt="Shared content" 
                        className="mt-2 rounded-lg max-w-full" 
                      />
                    )}
                  </div>
                </motion.div>
              ))}
              <div ref={endOfMessagesRef} />
            </div>
          </div>
          
          <div className="p-4 bg-white border-t border-border">
            <div className="mb-3 overflow-x-auto flex gap-2 pb-2">
              {suggestions.map((suggestion, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  onClick={() => setInput(suggestion)}
                  className="whitespace-nowrap px-3 py-1.5 bg-secondary text-muted-foreground rounded-full text-sm hover:text-foreground hover:bg-secondary/80 transition-colors"
                >
                  {suggestion}
                </motion.button>
              ))}
            </div>
            
            <div className="flex items-center gap-2 relative">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="rounded-full flex-shrink-0"
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? (
                  <MicOff className="h-5 w-5 text-red-500" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
              
              <div className="flex-1 flex items-center bg-secondary rounded-full pr-1">
                <Input
                  type="text"
                  placeholder="Type a message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent flex-1"
                />
                <div className="flex items-center">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full"
                  >
                    <SmilePlus className="h-5 w-5 text-muted-foreground" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full"
                  >
                    <Image className="h-5 w-5 text-muted-foreground" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full"
                  >
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
              
              <Button
                type="button"
                size="icon"
                disabled={!input.trim()}
                onClick={handleSend}
                className="rounded-full flex-shrink-0"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
