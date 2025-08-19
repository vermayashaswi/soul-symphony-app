import React from "react";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { formatShortDate } from "@/utils/format-time";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { TranslatableMarkdown } from "@/components/translation/TranslatableMarkdown";
import TypingIndicator from "../TypingIndicator";
import ParticleAvatar from "../ParticleAvatar";
import { getSanitizedFinalContent } from "@/utils/messageParser";

import { ChatMessage } from '@/types/chat';
 
 interface MobileChatMessageProps {
  message: ChatMessage;
  showAnalysis?: boolean;
  isLoading?: boolean;
  streamingMessage?: string;
  showStreamingDots?: boolean;
  userId?: string;
}

const MobileChatMessage: React.FC<MobileChatMessageProps> = ({ 
  message, 
  showAnalysis = false, 
  isLoading = false, 
  streamingMessage,
  showStreamingDots = false,
  userId
}) => {
  // CRITICAL FIX: Always call all hooks before any conditional logic
  const [showReferences, setShowReferences] = useState(false);
  const { user } = useAuth();
  
  // Memoize formatted content - this hook must always be called
  const formattedContent = React.useMemo(() => {
    if (message.sender === 'assistant') {
      return getSanitizedFinalContent(message.content);
    }
    return message.content;
  }, [message]);
  
  // Determine what type of content to render
  const shouldShowLoading = isLoading && !streamingMessage;
  const shouldShowStreaming = !!streamingMessage;
  const shouldShowMessage = !shouldShowLoading && !shouldShowStreaming;
  
  // Calculate derived values
  const hasReferences = message.sender === 'assistant' && message.reference_entries && Array.isArray(message.reference_entries) && message.reference_entries.length > 0;
  const displayRole = message.sender === 'error' ? 'assistant' : message.sender;
  
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
        {/* Show avatar only when there's a streaming message with content */}
        {streamingMessage && (
          <div className="border border-primary/20 rounded-full">
            <ParticleAvatar className="w-8 h-8" size={32} />
          </div>
        )}
        
        {/* For general mental health queries (showStreamingDots=true, streamingMessage=undefined), show only dots */}
        {showStreamingDots && !streamingMessage ? (
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
        ) : streamingMessage && (
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
        )}
      </motion.div>
    );
  }
  
  const messageContent = (
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
        
        {showAnalysis && displayRole === 'assistant' && message.analysis_data && (
          <div className="mt-3 text-xs opacity-70">
            <Separator className="my-2" />
            <div className="font-semibold">
              <TranslatableText text="Analysis:" forceTranslate={true} />
            </div>
            <p>
              <TranslatableText text={message.analysis_data.analysis} forceTranslate={true} />
            </p>
            {message.analysis_data.requiresSql && (
              <>
                <div className="font-semibold mt-1">
                  <TranslatableText text="SQL Query:" forceTranslate={true} />
                </div>
                <pre className="text-[10px] bg-black/10 p-1 rounded overflow-x-auto">
                  {message.analysis_data.sqlQuery}
                </pre>
              </>
            )}
          </div>
        )}
        
        {hasReferences && (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-6 text-xs font-medium flex items-center gap-1 text-muted-foreground dark:text-white/70 dark:hover:text-white"
              onClick={() => setShowReferences(!showReferences)}
            >
              <FileText className="h-3 w-3 mr-1" />
              <TranslatableText 
                text={`${(message.reference_entries as any[])!.length} journal entries`}
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="compact"
              />
              {showReferences ? (
                <ChevronUp className="h-3 w-3 ml-1" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-1" />
              )}
            </Button>
            
            <AnimatePresence>
              {showReferences && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-1 text-xs max-h-32 overflow-y-auto border-l-2 border-primary/30 pl-2 pr-1"
                >
                  {(message.reference_entries as any[])!.slice(0, 2).map((ref, idx) => {
                    // Handle the new formatShortDate return type
                    const formattedDate = ref.date && !isNaN(new Date(ref.date).getTime()) 
                      ? formatShortDate(new Date(ref.date))
                      : { type: 'translatable' as const, text: 'Unknown date' };
                    
                    return (
                      <div key={idx} className="mb-1 py-1">
                        <div className="font-medium dark:text-white/90">
                          <TranslatableText 
                            text={formattedDate.text} 
                            forceTranslate={formattedDate.type === 'translatable'}
                            enableFontScaling={true}
                            scalingContext="compact"
                          />
                        </div>
                        <div className="text-muted-foreground dark:text-white/70">
                          <TranslatableText 
                            text={ref.snippet} 
                            forceTranslate={true}
                            enableFontScaling={true}
                            scalingContext="compact"
                          />
                        </div>
                      </div>
                    );
                  })}
                  {(message.reference_entries as any[])!.length > 2 && (
                    <div className="text-xs text-muted-foreground dark:text-white/60">
                      <TranslatableText 
                        text={`+${(message.reference_entries as any[])!.length - 2} more entries`}
                        forceTranslate={true}
                        enableFontScaling={true}
                        scalingContext="compact"
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
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


  return messageContent;
};

export default MobileChatMessage;