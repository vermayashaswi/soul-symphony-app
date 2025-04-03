
import { useState, FormEvent, KeyboardEvent } from "react";
import { SendHorizonal, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  userId?: string;
  disabled?: boolean;
}

const ChatInput = ({ onSendMessage, isLoading, userId, disabled = false }: ChatInputProps) => {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    if (!userId) {
      toast.error("Please sign in to send messages");
      return;
    }
    
    onSendMessage(message);
    setMessage("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && message.trim()) {
        handleSubmit(e);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex items-end gap-2">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your journal entries..."
        className="min-h-[56px] resize-none max-h-28 pr-14"
        disabled={isLoading || disabled}
      />
      <div className="flex-shrink-0">
        <Button 
          type="submit" 
          disabled={!message.trim() || isLoading || disabled}
          className="h-[56px] w-[56px] rounded-full"
        >
          {isLoading ? (
            <div className="animate-spin h-5 w-5 border-b-2 border-white rounded-full" />
          ) : (
            <SendHorizonal className="h-5 w-5" />
          )}
        </Button>
      </div>
    </form>
  );
};

export default ChatInput;
