
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Mic, MicOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { recordAudio } from "@/utils/audioRecorder";
import { useDebugLog } from "@/utils/debug/DebugContext";

interface MobileChatInputProps {
  onSendMessage: (message: string, isAudio?: boolean) => void;
  isLoading: boolean;
  userId?: string;
}

export default function MobileChatInput({
  onSendMessage,
  isLoading,
  userId
}: MobileChatInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recordingRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chatDebug = useDebugLog();

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingTime(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    adjustTextareaHeight(e.target);
  };

  const adjustTextareaHeight = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (isLoading || isSubmitting) return;

    const trimmedValue = inputValue.trim();
    if (trimmedValue) {
      try {
        chatDebug.addEvent("User Message", `Preparing to send: "${trimmedValue.substring(0, 30)}${trimmedValue.length > 30 ? '...' : ''}"`, "info");
        setIsSubmitting(true);
        
        chatDebug.addEvent("Send Message", "Calling onSendMessage handler", "info");
        onSendMessage(trimmedValue);
        
        setInputValue("");
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
          inputRef.current.focus();
        }
        
        chatDebug.addEvent("User Input", "Reset input field after sending", "success");
      } catch (error) {
        console.error("Error sending message:", error);
        chatDebug.addEvent("Send Error", error instanceof Error ? error.message : "Unknown error sending message", "error");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleStartRecording = async () => {
    chatDebug.addEvent("Audio Recording", "Starting audio recording...", "info");
    try {
      const recorder = await recordAudio();
      recordingRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      chatDebug.addEvent("Audio Recording", "Recording started successfully", "success");
    } catch (error) {
      chatDebug.addEvent("Audio Recording", error instanceof Error ? error.message : "Could not access microphone", "error");
      console.error("Error starting recording:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const handleStopRecording = async () => {
    chatDebug.addEvent("Audio Recording", "Stopping audio recording...", "info");
    if (!recordingRef.current) return;
    
    try {
      setIsSubmitting(true);
      const audio = await recordingRef.current.stop();
      setIsRecording(false);
      
      const audioBlob = await fetch(audio.audioUrl).then(r => r.blob());
      
      chatDebug.addEvent("Audio Recording", `Recording completed (${recordingTime}s)`, "success");
      
      onSendMessage("I sent an audio message", true);
      
      chatDebug.addEvent("Audio Processing", "Sending audio message placeholder", "info");
    } catch (error) {
      chatDebug.addEvent("Audio Recording", error instanceof Error ? error.message : "Error stopping recording", "error");
      console.error("Error stopping recording:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="p-3 bg-background border-t border-border flex items-end gap-2">
      <div className="flex-1 relative">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder="Type your message..."
          className="w-full border rounded-lg py-2 px-3 pr-10 focus:outline-none focus:ring-1 focus:ring-primary resize-none min-h-[40px] max-h-[120px] bg-background"
          disabled={isLoading || isSubmitting || isRecording}
        />
      </div>
      
      <div className="flex-shrink-0">
        {isRecording ? (
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 rounded-full bg-red-500 hover:bg-red-600 text-white"
            onClick={handleStopRecording}
            disabled={isLoading || isSubmitting}
          >
            <MicOff className="h-5 w-5" />
          </Button>
        ) : inputValue.trim() ? (
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={handleSendMessage}
            disabled={isLoading || isSubmitting}
          >
            {isSubmitting || isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={handleStartRecording}
            disabled={isLoading || isSubmitting || !userId}
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}
      </div>
      
      {isRecording && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full flex items-center"
        >
          <div className="w-2 h-2 rounded-full bg-white animate-pulse mr-2"></div>
          <span>Recording: {formatTime(recordingTime)}</span>
        </motion.div>
      )}
    </div>
  );
}
