
import React from "react";
import ReactMarkdown from 'react-markdown';
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { formatShortDate } from "@/utils/format-time";

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
}

const MobileChatMessage: React.FC<MobileChatMessageProps> = ({ message, showAnalysis = false }) => {
  const [showReferences, setShowReferences] = useState(false);
  const { user } = useAuth();
  
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
      className={`relative flex items-start gap-2 ${displayRole === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      {displayRole === 'assistant' && (
        <Avatar className="w-8 h-8 border border-primary/20">
          <AvatarImage 
            src="/lovable-uploads/3f275134-f471-4af9-a7cd-700ccd855fe3.png" 
            alt="Ruh"
            className="bg-primary/10 object-cover"
            loading="eager"
          />
          <AvatarFallback className="bg-primary/10 text-primary text-xs">R</AvatarFallback>
        </Avatar>
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
          <ReactMarkdown className="prose dark:prose-invert prose-sm max-w-none break-words">
            {formattedContent}
          </ReactMarkdown>
        ) : (
          <p className="break-words">{message.content}</p>
        )}
        
        {showAnalysis && displayRole === 'assistant' && message.analysis && (
          <div className="mt-3 text-xs opacity-70">
            <Separator className="my-2" />
            <div className="font-semibold">Analysis:</div>
            <p>{message.analysis.analysis}</p>
            {message.analysis.requiresSql && (
              <>
                <div className="font-semibold mt-1">SQL Query:</div>
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
              {message.references!.length} journal entries
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
                  {message.references!.slice(0, 2).map((ref, idx) => (
                    <div key={idx} className="mb-1 py-1">
                      <div className="font-medium dark:text-white/90">
                        {ref.date && !isNaN(new Date(ref.date).getTime()) 
                          ? formatShortDate(new Date(ref.date))
                          : "Unknown date"}
                      </div>
                      <div className="text-muted-foreground dark:text-white/70">{ref.snippet}</div>
                    </div>
                  ))}
                  {message.references!.length > 2 && (
                    <div className="text-xs text-muted-foreground dark:text-white/60">
                      +{message.references!.length - 2} more entries
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
