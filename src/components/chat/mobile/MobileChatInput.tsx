
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { SendHorizonal } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import VoiceRecordingButton from '@/components/chat/VoiceRecordingButton';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';

interface MobileChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

const MobileChatInput: React.FC<MobileChatInputProps> = ({ onSendMessage, disabled = false }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  // Use the audio recorder hook with the correct return values
  const { 
    isRecording, 
    recordingTime, 
    audioBlob, 
    startRecording, 
    stopRecording 
  } = useAudioRecorder();

  // When audio is recorded, we'll need to handle it
  useEffect(() => {
    if (audioBlob) {
      // In a real implementation, we would process the audio blob here
      // For now, we'll just log it
      console.log("Audio recording completed:", audioBlob);
    }
  }, [audioBlob]);

  // Auto-resize textarea as content grows
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [message]);

  // Handle keyboard visibility detection
  useEffect(() => {
    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.75;
        setIsKeyboardVisible(isKeyboard);
        
        // Dispatch custom event for other components to respond
        window.dispatchEvent(new CustomEvent(isKeyboard ? 'keyboardOpen' : 'keyboardClose'));
      }
    };
    
    handleVisualViewportResize();
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
    }
    
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className={`p-2 relative flex items-end ${isKeyboardVisible ? 'input-keyboard-active' : ''}`}
    >
      <div className="relative flex-1 mr-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Processing..." : "Your message..."}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring pr-10 resize-none min-h-[40px] max-h-[120px]"
          disabled={disabled || isRecording}
          rows={1}
        />
        <div className="absolute right-2 bottom-2">
          <VoiceRecordingButton
            isRecording={isRecording}
            recordingTime={recordingTime}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            isLoading={disabled}
            size="sm"
          />
        </div>
      </div>
      <Button 
        type="submit" 
        size="icon" 
        disabled={!message.trim() || disabled || isRecording}
        className="h-10 w-10 rounded-full"
      >
        <SendHorizonal className="h-5 w-5" />
      </Button>
    </form>
  );
};

export default MobileChatInput;
