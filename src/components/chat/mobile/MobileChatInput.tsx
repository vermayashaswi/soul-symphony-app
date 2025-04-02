
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Mic, Loader2, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { motion } from "framer-motion";

interface MobileChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  userId?: string;
}

export default function MobileChatInput({ 
  onSendMessage, 
  isLoading,
  userId 
}: MobileChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const {
    startRecording,
    stopRecording,
    isRecording: recorderIsRecording,
    recordingTime,
    audioBlob
  } = useVoiceRecorder();

  // Handle text transcription - removed since useVoiceRecorder doesn't have these properties
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    if (!userId) {
      toast.error("Please sign in to chat");
      return;
    }
    
    onSendMessage(message.trim());
    setMessage("");
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleVoiceRecording = async () => {
    if (recorderIsRecording) {
      setIsRecording(false);
      await stopRecording();
      // We'll handle the transcription elsewhere since useVoiceRecorder doesn't have isProcessing and transcription
      console.log("Recording stopped, audio blob:", audioBlob);
    } else {
      try {
        setIsRecording(true);
        await startRecording();
      } catch (error) {
        console.error("Error starting recording:", error);
        toast.error("Could not access microphone. Please check permissions.");
        setIsRecording(false);
      }
    }
  };

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-2">
      <Textarea
        ref={textareaRef}
        value={message}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Message Roha..."
        className="min-h-[40px] max-h-[120px] resize-none text-base border-muted rounded-full px-4 py-2"
        disabled={isLoading || !userId || isRecording}
      />
      {!isRecording ? (
        <>
          <Button 
            type="button" 
            size="icon" 
            onClick={handleVoiceRecording}
            disabled={isLoading || !userId}
            className="rounded-full h-10 w-10 flex-shrink-0 bg-muted border-muted"
            variant="outline"
          >
            <Mic className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button 
            type="submit" 
            size="icon" 
            disabled={isLoading || !message.trim() || !userId} 
            className="rounded-full h-10 w-10 flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </>
      ) : (
        <Button 
          type="button" 
          size="icon" 
          onClick={handleVoiceRecording}
          className={`rounded-full h-10 w-10 flex-shrink-0 ${isRecording ? 'bg-red-500 hover:bg-red-600' : ''}`}
        >
          <StopCircle className="h-5 w-5" />
          {isRecording && (
            <motion.div 
              className="absolute inset-0 rounded-full recording-indicator"
              animate={{ 
                boxShadow: ['0 0 0 0 rgba(239, 68, 68, 0.7)', '0 0 0 10px rgba(239, 68, 68, 0)'] 
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity,
                repeatType: "loop"
              }}
            />
          )}
        </Button>
      )}
      
      {/* Recording time indicator */}
      {isRecording && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg">
          {formatTime(recordingTime)}
        </div>
      )}
    </form>
  );
}
