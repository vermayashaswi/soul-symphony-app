
import React, { useState } from "react";
import { Send, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import VoiceRecordingButton from "../VoiceRecordingButton";
import { sendAudioForTranscription } from "@/utils/audio/transcription-service";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface MobileChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  userId?: string;
}

const MobileChatInput: React.FC<MobileChatInputProps> = ({ 
  onSendMessage, 
  isLoading,
  userId
}) => {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const { toast } = useToast();

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
      
      toast({
        title: "Processing voice",
        description: "Converting your voice to text...",
      });
      
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
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    onSendMessage(message);
    setMessage("");
    setIsFocused(false);
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex w-full gap-2 items-end">
        <div className="relative flex-1">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask a question..."
            className="min-h-[40px] max-h-[120px] text-sm resize-none rounded-full pl-4 pr-10 py-2"
            disabled={isLoading || isRecording}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <AnimatePresence>
            {!isRecording && message.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute right-2 bottom-1"
              >
                <VoiceRecordingButton
                  isLoading={isLoading}
                  isRecording={isRecording}
                  recordingTime={recordingTime}
                  onStartRecording={handleStartRecording}
                  onStopRecording={handleStopRecording}
                  size="sm"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {(message.trim().length > 0 || isRecording) && (
          <Button 
            type="submit" 
            size="sm"
            className="rounded-full h-10 w-10 p-0"
            disabled={isLoading || isRecording || !message.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
      
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center gap-2 justify-center mt-2"
          >
            <div className="flex items-center gap-2 bg-destructive/10 px-3 py-1 rounded-full">
              <motion.div 
                className="w-2 h-2 rounded-full bg-destructive"
                animate={{ 
                  opacity: [1, 0.4, 1],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 1.2,
                  ease: "easeInOut"
                }}
              />
              <span className="text-sm font-medium text-destructive">Recording {recordingTime}s</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileChatInput;
