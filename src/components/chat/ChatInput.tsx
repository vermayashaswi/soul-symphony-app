
import React, { useState, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import VoiceRecordingButton from "./VoiceRecordingButton";
import { sendAudioForTranscription } from "@/utils/audio/transcription-service";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  userId?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  isLoading,
  userId
}) => {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Focus the textarea when component mounts (on desktop)
  useEffect(() => {
    if (!isMobile) {
      const textarea = document.querySelector('textarea');
      if (textarea) textarea.focus();
    }
  }, [isMobile]);

  const handleStartRecording = () => {
    if (!userId) {
      toast({
        title: "Authentication required",
        description: "Please sign in to use voice input.",
        variant: "destructive"
      });
      return;
    }
    
    setIsRecording(true);
    setRecordingTime(0);
    
    const timer = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
    setRecordingTimer(timer);
  };

  const handleStopRecording = async (blob: Blob) => {
    setIsRecording(false);
    
    if (recordingTimer) {
      clearInterval(recordingTimer);
      setRecordingTimer(null);
    }
    setRecordingTime(0);
    
    if (!userId) return;
    
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      
      try {
        const result = await sendAudioForTranscription(base64Data, userId);
        
        if (result.success && result.data?.transcription) {
          const transcription = result.data.transcription;
          setMessage(transcription);
          onSendMessage(transcription);
        } else {
          toast({
            title: "Transcription failed",
            description: result.error || "Failed to transcribe audio. Try speaking clearly and try again.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("Error transcribing audio:", error);
        toast({
          title: "Error",
          description: "Failed to process audio. Please try again.",
          variant: "destructive"
        });
      }
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    onSendMessage(message);
    setMessage("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={isMobile ? "Ask a question..." : "Ask about your journal entries..."}
        className="flex-1 min-h-[60px] max-h-[120px] resize-none text-sm md:text-base"
        disabled={isLoading || isRecording}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
      />
      <div className="flex flex-col gap-2">
        <VoiceRecordingButton
          isLoading={isLoading}
          isRecording={isRecording}
          recordingTime={recordingTime}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
        />
        <Button 
          type="submit" 
          size="icon" 
          disabled={isLoading || isRecording || !message.trim()}
        >
          <Send className="h-4 w-4 md:h-5 md:w-5" />
        </Button>
      </div>
    </form>
  );
};

export default ChatInput;
