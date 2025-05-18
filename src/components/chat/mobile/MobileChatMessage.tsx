
import React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { Button } from "@/components/ui/button";

interface MobileChatMessageProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
    references?: any[];
    analysis?: any;
    hasNumericResult?: boolean;
    isInteractive?: boolean;
    interactiveOptions?: any[];
  };
  showAnalysis: boolean;
  onInteractiveOptionClick?: (option: any) => void;
}

const MobileChatMessage: React.FC<MobileChatMessageProps> = ({ 
  message, 
  showAnalysis,
  onInteractiveOptionClick
}) => {
  const { user } = useAuth();

  // Create memoized content to avoid re-renders
  const formattedContent = React.useMemo(() => {
    return message.content;
  }, [message.content]);

  const hasInteractiveOptions = 
    message.role === 'assistant' && 
    message.isInteractive && 
    message.interactiveOptions && 
    message.interactiveOptions.length > 0;

  return (
    <div
      className={`flex items-start gap-3 ${
        message.role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      {message.role === "assistant" && (
        <Avatar className="h-8 w-8 border border-primary/20 mt-1">
          <AvatarImage
            src="/lovable-uploads/3f275134-f471-4af9-a7cd-700ccd855fe3.png"
            alt="Ruh"
            className="bg-primary/10 object-cover"
            loading="eager"
          />
          <AvatarFallback className="bg-primary/10 text-primary">R</AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          "max-w-[80%] rounded-2xl p-3 text-sm shadow-sm",
          message.role === "user"
            ? "bg-primary text-primary-foreground rounded-tr-none"
            : "bg-muted border border-border/50 rounded-tl-none"
        )}
      >
        <TranslatableText text={formattedContent} forceTranslate={true} />

        {/* Interactive options for clarification questions */}
        {hasInteractiveOptions && (
          <div className="mt-3 flex flex-col gap-2">
            {message.interactiveOptions.map((option, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="text-left justify-start h-auto py-2 text-xs"
                onClick={() => onInteractiveOptionClick && onInteractiveOptionClick(option)}
              >
                <TranslatableText text={option.text} forceTranslate={true} />
              </Button>
            ))}
          </div>
        )}
      </div>

      {message.role === "user" && (
        <Avatar className="h-8 w-8 border border-primary/20 mt-1">
          <AvatarImage
            src={user?.user_metadata?.avatar_url}
            alt="User"
            className="bg-primary/20"
            loading="eager"
          />
          <AvatarFallback className="bg-primary/20 text-primary">
            {user?.user_metadata?.full_name
              ? user.user_metadata.full_name.charAt(0)
              : user?.email?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default MobileChatMessage;
