
import React from "react";
import ReactMarkdown from 'react-markdown';
import { Separator } from "@/components/ui/separator";
import { Bot, User, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MobileChatMessageProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
    analysis?: any;
    references?: any[];
    diagnostics?: any;
    hasNumericResult?: boolean;
  };
  showAnalysis?: boolean; // Make this prop optional
}

const MobileChatMessage: React.FC<MobileChatMessageProps> = ({ message, showAnalysis = false }) => { // Add default value
  const { user } = useAuth();
  
  // Get user avatar from metadata
  const userAvatarUrl = user?.user_metadata?.avatar_url || '';
  
  // Format content if it contains object notation
  const formattedContent = React.useMemo(() => {
    if (message.role === 'assistant' && message.content.includes('[object Object]')) {
      try {
        // Try to extract and format emotion data from the content
        const regex = /Here's what I found: (.*)/;
        const match = message.content.match(regex);
        
        if (match && match[1]) {
          // If there's emotion data, we'll replace it with a formatted version
          let formattedData = message.content;
          
          // Check if we have JSON data in diagnostics
          if (message.diagnostics && message.diagnostics.executionResults) {
            const emotionResults = message.diagnostics.executionResults.find(
              (result: any) => Array.isArray(result.result) && 
                result.result[0] && 
                typeof result.result[0] === 'object' && 
                (result.result[0].emotion || result.result[0].emotions)
            );
            
            if (emotionResults && emotionResults.result) {
              const emotionData = emotionResults.result.map((item: any) => {
                const emotion = item.emotion || Object.keys(item)[0];
                const score = item.score || item[emotion];
                return `${emotion} (${typeof score === 'number' ? score.toFixed(2) : score})`;
              }).join(', ');
              
              formattedData = formattedData.replace(match[1], emotionData);
            }
          }
          
          return formattedData;
        }
      } catch (error) {
        console.error("Error formatting emotion data:", error);
      }
    }
    
    return message.content;
  }, [message]);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative flex items-start gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      {message.role === 'assistant' && (
        <div className="w-8 h-8 rounded-full flex-shrink-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src="/roha-avatar.png" alt="Roha" />
            <AvatarFallback className="bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      
      <div
        className={cn(
          "min-w-0 max-w-[85%] rounded-2xl p-3.5 text-sm shadow-sm",
          message.role === 'user' 
            ? 'bg-primary text-primary-foreground rounded-tr-none' 
            : 'bg-muted/60 border border-border/50 rounded-tl-none'
        )}
      >
        {message.role === 'assistant' ? (
          <ReactMarkdown className="prose dark:prose-invert prose-sm max-w-none break-words">
            {formattedContent}
          </ReactMarkdown>
        ) : (
          <p className="break-words">{message.content}</p>
        )}
        
        {showAnalysis && message.role === 'assistant' && message.analysis && (
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
        
        {message.role === 'assistant' && message.references && message.references.length > 0 && (
          <div className="mt-2">
            <div className="p-0 h-6 text-xs font-medium flex items-center gap-1 text-muted-foreground">
              <FileText className="h-3 w-3 mr-1" />
              {message.references.length} journal entries referenced
            </div>
          </div>
        )}
      </div>
      
      {message.role === 'user' && (
        <div className="w-8 h-8 rounded-full flex-shrink-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src={userAvatarUrl} alt="User" />
            <AvatarFallback className="bg-primary/20">
              <User className="h-4 w-4 text-primary" />
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </motion.div>
  );
};

export default MobileChatMessage;
