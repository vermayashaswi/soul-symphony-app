
import React, { useState } from "react";
import ReactMarkdown from 'react-markdown';
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { formatShortDate } from "@/utils/format-time";

interface ChatMessageProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
    analysis?: any;
    references?: any[];
    diagnostics?: any;
    hasNumericResult?: boolean;
  };
  showAnalysis: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, showAnalysis }) => {
  const isMobile = useIsMobile();
  const [showReferences, setShowReferences] = useState(false);
  const { user } = useAuth();
  
  const formattedContent = React.useMemo(() => {
    return message.content;
  }, [message]);
  
  const hasReferences = message.role === 'assistant' && message.references && message.references.length > 0;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex items-start gap-3.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-5`}
    >
      {message.role === 'assistant' && (
        <Avatar className="h-10 w-10 mt-1 border border-primary/20">
          <AvatarImage 
            src="/lovable-uploads/72655ba1-b64a-45bf-b7d9-a14e60827087.png" 
            alt="Roha"
            className="bg-primary/10"
            loading="eager"
          />
          <AvatarFallback className="bg-primary/10 text-primary">R</AvatarFallback>
        </Avatar>
      )}
      
      <div
        className={cn(
          "max-w-[85%] md:max-w-[75%] p-4 text-base shadow-md overflow-hidden relative",
          message.role === 'user' 
            ? 'bg-fuchsia-500 text-white rounded-3xl rounded-br-none' 
            : 'bg-gray-800 text-white rounded-3xl rounded-tl-none border border-gray-700'
        )}
      >
        {hasReferences && (
          <div className="absolute bottom-1 left-1 z-10">
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-6 flex items-center gap-1 text-fuchsia-400 hover:text-fuchsia-300 bg-gray-900/80 rounded-full px-2.5 backdrop-blur-sm"
              onClick={() => setShowReferences(!showReferences)}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              {message.references.length} journal entries
              {showReferences ? (
                <ChevronUp className="h-2.5 w-2.5 ml-1" />
              ) : (
                <ChevronDown className="h-2.5 w-2.5 ml-1" />
              )}
            </Button>
            
            <AnimatePresence>
              {showReferences && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="absolute bottom-8 left-0 mb-1 max-h-40 md:max-h-60 overflow-y-auto border border-fuchsia-500/30 rounded-md p-2 bg-gray-900/90 backdrop-blur-sm w-72"
                >
                  {message.references.slice(0, isMobile ? 2 : 3).map((ref, idx) => (
                    <div key={idx} className="mb-2 py-1">
                      <div className="font-medium text-sm text-white/90">
                        {ref.date && !isNaN(new Date(ref.date).getTime())
                          ? formatShortDate(new Date(ref.date))
                          : "Unknown date"}
                      </div>
                      <div className="text-white/70 text-xs">{ref.snippet}</div>
                    </div>
                  ))}
                  {message.references.length > (isMobile ? 2 : 3) && (
                    <div className="text-xs text-white/60">
                      +{message.references.length - (isMobile ? 2 : 3)} more entries
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        
        {message.role === 'assistant' ? (
          <div className="prose dark:prose-invert prose-base max-w-none break-words overflow-hidden text-white">
            <ReactMarkdown>
              {formattedContent}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="break-words overflow-hidden text-white">{message.content}</p>
        )}
        
        {showAnalysis && message.role === 'assistant' && message.analysis && (
          <div className="mt-3 text-sm opacity-80">
            <Separator className="my-2" />
            <div className="font-semibold">Analysis:</div>
            <p>{message.analysis.analysis}</p>
            {message.analysis.requiresSql && (
              <>
                <div className="font-semibold mt-1">SQL Query:</div>
                <pre className={`${isMobile ? 'text-[10px]' : 'text-xs'} bg-black/10 p-1 rounded overflow-x-auto`}>
                  {message.analysis.sqlQuery}
                </pre>
              </>
            )}
          </div>
        )}
        
        {showAnalysis && message.role === 'assistant' && message.diagnostics && renderDiagnostics(message.diagnostics, isMobile)}
      </div>
      
      {message.role === 'user' && (
        <Avatar className="h-10 w-10 mt-1 border border-fuchsia-500/20">
          <AvatarImage 
            src={user?.user_metadata?.avatar_url} 
            alt="User"
            className="bg-fuchsia-500/20"
            loading="eager"
          />
          <AvatarFallback className="bg-fuchsia-500/20 text-fuchsia-500">
            {user?.user_metadata?.full_name ? 
              user.user_metadata.full_name.charAt(0) : 
              user?.email?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
      )}
    </motion.div>
  );
};

const renderDiagnostics = (diagnostics: any, isMobile: boolean) => {
  if (!diagnostics) return null;
  
  return (
    <div className="mt-3 text-xs">
      <Separator className="my-2" />
      <div className="font-semibold">Query Diagnostics:</div>
      <div className={`max-h-40 md:max-h-60 overflow-y-auto mt-1 bg-slate-800 p-2 rounded text-slate-200 ${isMobile ? 'text-[9px]' : 'text-xs'}`}>
        {diagnostics.query_plan && (
          <div>
            <div className="font-medium">Sample Answer:</div>
            <div className="text-xs whitespace-pre-wrap mb-2">{diagnostics.query_plan.sample_answer}</div>
            
            {!isMobile && (
              <>
                <div className="font-medium">Execution Plan:</div>
                {diagnostics.query_plan.execution_plan.map((segment: any, idx: number) => (
                  <div key={idx} className="mb-2 border-l-2 border-blue-500 pl-2">
                    <div><span className="font-medium">Segment:</span> {segment.segment}</div>
                    <div><span className="font-medium">Type:</span> {segment.segment_type}</div>
                    {segment.sql_query && (
                      <div>
                        <span className="font-medium">SQL:</span>
                        <pre className="text-xs overflow-x-auto">{segment.sql_query}</pre>
                      </div>
                    )}
                    {segment.vector_search && (
                      <div><span className="font-medium">Vector Search:</span> {segment.vector_search}</div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        
        {!isMobile && diagnostics.execution_results && (
          <div className="mt-2">
            <div className="font-medium">Execution Results:</div>
            {diagnostics.execution_results.execution_results.map((result: any, idx: number) => (
              <div key={idx} className="mb-2 border-l-2 border-green-500 pl-2">
                <div><span className="font-medium">Segment:</span> {result.segment}</div>
                <div><span className="font-medium">Type:</span> {result.type}</div>
                {result.error ? (
                  <div className="text-red-400"><span className="font-medium">Error:</span> {result.error}</div>
                ) : (
                  <div>
                    <span className="font-medium">Result:</span>
                    <pre className="text-xs overflow-x-auto">{JSON.stringify(result.result, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
