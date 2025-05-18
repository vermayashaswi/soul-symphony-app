import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Mic, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileChatMessage from "./MobileChatMessage";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { TranslatableText } from "@/components/translation/TranslatableText";

interface MobileChatInterfaceProps {
  chatMessages: any[];
  isLoading: boolean;
  processingStage?: string;
  onSend: (message: string, isAudio: boolean) => Promise<void>;
  onInteractiveOptionClick?: (option: any) => void;
  showAnalysis: boolean;
}

const MobileChatInterface: React.FC<MobileChatInterfaceProps> = ({
  chatMessages,
  isLoading,
  processingStage,
  onSend,
  onInteractiveOptionClick,
  showAnalysis
}) => {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const { isMobile } = useIsMobile();

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const sendMessage = async (message: string, isAudio: boolean = false) => {
    if (!message.trim() && !isAudio) return;

    try {
      await onSend(message, isAudio);
      setMessage("");
      setAudioURL(null);
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: `Failed to send message: ${error.message || error}`,
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(message);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages Area */}
      <div className="flex-grow p-4 overflow-y-auto">
        {chatMessages.length === 0 && !isLoading ? (
          <div className="flex items-center justify-center h-full">
            <TranslatableText text="Start a conversation!" />
          </div>
        ) : (
          chatMessages.map((msg, index) => (
            <MobileChatMessage
              key={index}
              message={msg}
              showAnalysis={showAnalysis}
              onInteractiveOptionClick={onInteractiveOptionClick}
            />
          ))
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center space-y-2 p-4 my-2 rounded-lg bg-primary/5">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            <p className="text-sm text-muted-foreground">
              <TranslatableText
                text={processingStage || "Processing your request..."}
                forceTranslate={true}
              />
            </p>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4 bg-background">
        <div className="relative flex items-center space-x-2">
          <Input
            ref={inputRef}
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-grow rounded-full py-2 pl-4 pr-12"
            disabled={isLoading}
          />
          <div className="absolute right-3 flex items-center space-x-1.5">
            {message.trim() && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMessage("")}
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => sendMessage(message)}
              disabled={isLoading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileChatInterface;
