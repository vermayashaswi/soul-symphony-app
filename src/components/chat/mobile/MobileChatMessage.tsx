import React from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { TranslatableMarkdown } from "@/components/translation/TranslatableMarkdown";
import TypingIndicator from "../TypingIndicator";
import ParticleAvatar from "../ParticleAvatar";
import { getSanitizedFinalContent } from "@/utils/messageParser";
 
 interface MobileChatMessageProps {
  message: {
    role: 'user' | 'assistant' | 'error';
    content: string;
    analysis?: any;
    references?: any[];
    diagnostics?: any;
    hasNumericResult?: boolean;
  };
  showAnalysis?: boolean;
  isLoading?: boolean;
  streamingMessage?: string;
  showStreamingDots?: boolean;
}

const MobileChatMessage: React.FC<MobileChatMessageProps> = ({ 
  message, 
  showAnalysis = false, 
  isLoading = false, 
  streamingMessage,
  showStreamingDots = false 
}) => {
  // CRITICAL FIX: Always call all hooks before any conditional logic
  const { user } = useAuth();
  
  // Memoize formatted content - this hook must always be called
  const formattedContent = React.useMemo(() => {
    if (message.role === 'assistant') {
      return getSanitizedFinalContent(message.content);
    }
    return message.content;
  }, [message]);
  
  // Determine what type of content to render
  const shouldShowLoading = isLoading && !streamingMessage && !showStreamingDots;
  const shouldShowStreaming = !!streamingMessage || showStreamingDots;
  const shouldShowMessage = !shouldShowLoading && !shouldShowStreaming;
  
  // Calculate derived values
  const displayRole = message.role === 'error' ? 'assistant' : message.role;
  
  // RENDER LOGIC: All conditional rendering moved after all hooks
  if (shouldShowLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-3"
      >
        <TypingIndicator className="justify-start" />
      </motion.div>
    );
  }
  
  if (shouldShowStreaming) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative flex items-start gap-2 justify-start mb-3"
      >
        {/* CRITICAL: Always show avatar during streaming (with content or dots) */}
        {(streamingMessage || showStreamingDots) && (
          <div className="border border-primary/20 rounded-full">
            <ParticleAvatar className="w-8 h-8" size={32} />
          </div>
        )}
        
        {/* Show three dots when showStreamingDots=true and no streamingMessage */}
        {(showStreamingDots && !streamingMessage) ? (
          <div className="flex items-center space-x-1 bg-muted/60 border border-border/50 rounded-2xl rounded-tl-none px-4 py-3">
            <div className="flex space-x-1">
              <div 
                className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"
                style={{
                  animationDelay: '0ms',
                  animationDuration: '1.4s'
                }}
              />
              <div 
                className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"
                style={{
                  animationDelay: '200ms',
                  animationDuration: '1.4s'
                }}
              />
              <div 
                className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"
                style={{
                  animationDelay: '400ms',
                  animationDuration: '1.4s'
                }}
              />
            </div>
          </div>
        ) : streamingMessage ? (
          <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-none p-3.5 text-sm shadow-sm bg-muted/60 border border-border/50">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{streamingMessage}</span>
              {showStreamingDots && (
                <div className="flex space-x-1">
                  <div 
                    className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-pulse"
                    style={{
                      animationDelay: '0ms',
                      animationDuration: '1.4s'
                    }}
                  />
                  <div 
                    className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-pulse"
                    style={{
                      animationDelay: '200ms',
                      animationDuration: '1.4s'
                    }}
                  />
                  <div 
                    className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-pulse"
                    style={{
                      animationDelay: '400ms',
                      animationDuration: '1.4s'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : null}
      </motion.div>
    );
  }
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative flex items-start gap-2 ${displayRole === 'user' ? 'justify-end' : 'justify-start'} mb-3`}
    >
      {displayRole === 'assistant' && (
        <div className="border border-primary/20 rounded-full">
          <ParticleAvatar className="w-8 h-8" size={32} />
        </div>
      )}
      
      <div
        className={cn(
          "min-w-0 max-w-[85%] rounded-2xl p-3.5 text-sm shadow-sm",
          displayRole === 'user' 
            ? 'bg-primary text-primary-foreground rounded-tr-none' 
            : 'bg-muted/60 border border-border/50 rounded-tl-none'
        )}
      >
        {displayRole === 'assistant' ? (
          <TranslatableMarkdown 
            className="prose dark:prose-invert prose-sm max-w-none break-words" 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="compact"
          >
            {formattedContent}
          </TranslatableMarkdown>
        ) : (
          <TranslatableText 
            text={message.content} 
            forceTranslate={true} 
            className="break-words"
            enableFontScaling={true}
            scalingContext="compact"
          />
        )}
        
        {showAnalysis && displayRole === 'assistant' && message.analysis && (
          <div className="mt-3 text-xs opacity-70">
            <Separator className="my-2" />
            <div className="font-semibold">
              <TranslatableText text="Analysis:" forceTranslate={true} />
            </div>
            <p>
              <TranslatableText text={message.analysis.analysis} forceTranslate={true} />
            </p>
            {message.analysis.requiresSql && (
              <>
                <div className="font-semibold mt-1">
                  <TranslatableText text="SQL Query:" forceTranslate={true} />
                </div>
                <pre className="text-[10px] bg-black/10 p-1 rounded overflow-x-auto">
                  {message.analysis.sqlQuery}
                </pre>
              </>
            )}
          </div>
        )}
      </div>
      
      {displayRole === 'user' && (
        <Avatar className="w-8 h-8 border border-primary/20">
          <AvatarImage 
            src={user?.user_metadata?.avatar_url} 
            alt="User"
            className="bg-primary/20"
            loading="eager"
          />
          <AvatarFallback className="bg-primary/20 text-primary text-xs">
            {user?.user_metadata?.full_name ? 
              user.user_metadata.full_name.charAt(0) : 
              user?.email?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
      )}
    </motion.div>
  );
};

export default MobileChatMessage;