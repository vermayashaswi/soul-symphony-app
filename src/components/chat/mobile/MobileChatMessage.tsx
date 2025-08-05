
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
  const [showReferences, setShowReferences] = useState(false);
  const { user } = useAuth();
  
  // Show typing indicator for basic loading state (when no streaming message)
  if (isLoading && !streamingMessage) {
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
  
  // Show streaming message with pulsating dots
  if (streamingMessage) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative flex items-start gap-2 justify-start mb-3"
      >
        <div className="border border-primary/20 rounded-full">
          <ParticleAvatar className="w-8 h-8" size={32} />
        </div>
        
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
      </motion.div>
    );
  }
  
  const hasReferences = message.role === 'assistant' && message.references && message.references.length > 0;
  
  const formattedContent = React.useMemo(() => {
    return message.content;
  }, [message]);
  
  // For UI purposes, treat 'error' role as 'assistant'
  const displayRole = message.role === 'error' ? 'assistant' : message.role;
  
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
                text={`${message.references!.length} journal entries`}
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
                  {message.references!.slice(0, 2).map((ref, idx) => {
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
                  {message.references!.length > 2 && (
                    <div className="text-xs text-muted-foreground dark:text-white/60">
                      <TranslatableText 
                        text={`+${message.references!.length - 2} more entries`}
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
};

export default MobileChatMessage;
