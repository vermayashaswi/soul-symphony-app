
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Mic, Loader2, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { motion } from "framer-motion";
import { sendAudioForTranscription } from "@/utils/audio/transcription-service";
import { useAuth } from "@/contexts/AuthContext";

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
  const [isProcessingTranscription, setIsProcessingTranscription] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  
  const {
    startRecording,
    stopRecording,
    isRecording,
    recordingTime,
    audioBlob,
    audioLevel
  } = useVoiceRecorder({
    noiseReduction: true,
    maxDuration: 60 // Limit to 60 seconds for chat
  });
  
  // Process audio for transcription when recording stops
  useEffect(() => {
    const processAudio = async () => {
      if (!isRecording && audioBlob && !transcriptionText && !isProcessingTranscription) {
        try {
          setIsProcessingTranscription(true);
          
          // Convert the audio blob to base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          
          reader.onloadend = async () => {
            const base64Audio = reader.result?.toString().split(',')[1];
            
            if (base64Audio) {
              // Send to transcription service
              const result = await sendAudioForTranscription(
                base64Audio,
                user?.id,
                true // Direct transcription mode
              );
              
              if (result.success && result.data?.transcription) {
                setTranscriptionText(result.data.transcription);
                setMessage(result.data.transcription);
                
                // Auto-resize textarea
                if (textareaRef.current) {
                  textareaRef.current.style.height = "auto";
                  textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                }
              } else {
                toast.error(result.error || "Failed to transcribe audio");
              }
            }
          };
        } catch (error) {
          console.error("Error processing audio:", error);
          toast.error("Failed to process audio recording");
        } finally {
          setIsProcessingTranscription(false);
        }
      }
    };
    
    processAudio();
  }, [isRecording, audioBlob, transcriptionText, isProcessingTranscription, user?.id]);
  
  const resetRecordingState = () => {
    setTranscriptionText("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    if (!userId) {
      toast.error("Please sign in to chat");
      return;
    }
    
    onSendMessage(message.trim());
    setMessage("");
    resetRecordingState();
    
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
    if (isRecording) {
      await stopRecording();
    } else {
      try {
        resetRecordingState();
        await startRecording();
      } catch (error) {
        console.error("Error starting recording:", error);
        toast.error("Could not access microphone. Please check permissions.");
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
        disabled={isLoading || !userId || isRecording || isProcessingTranscription}
      />
      {!isRecording ? (
        <>
          <Button 
            type="button" 
            size="icon" 
            onClick={handleVoiceRecording}
            disabled={isLoading || !userId || isProcessingTranscription}
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
      
      {/* Transcription processing indicator */}
      {isProcessingTranscription && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Transcribing...
        </div>
      )}
    </form>
  );
}
