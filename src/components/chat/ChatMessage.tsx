
import React, { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { formatShortDate } from "@/utils/format-time";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { TranslatableMarkdown } from "@/components/translation/TranslatableMarkdown";

interface ChatMessageProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
    analysis?: any;
    references?: any[];
    diagnostics?: any;
    hasNumericResult?: boolean;
    ambiguityInfo?: any; 
    isInteractive?: boolean;
    interactiveOptions?: any[];
  };
  showAnalysis: boolean;
  onInteractiveOptionClick?: (option: any) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  showAnalysis, 
  onInteractiveOptionClick 
}) => {
  const { isMobile } = useIsMobile();
  const [showReferences, setShowReferences] = useState(false);
  const [showAmbiguityInfo, setShowAmbiguityInfo] = useState(false);
  const { user } = useAuth();
  
  const formattedContent = React.useMemo(() => {
    return message.content;
  }, [message]);
  
  const hasReferences = message.role === 'assistant' && message.references && message.references.length > 0;
  const hasAmbiguityInfo = message.role === 'assistant' && message.ambiguityInfo && message.ambiguityInfo.needsClarification;
  const hasInteractiveOptions = message.role === 'assistant' && message.isInteractive && message.interactiveOptions && message.interactiveOptions.length > 0;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
    >
      {message.role === 'assistant' && (
        <Avatar className="h-10 w-10 border border-primary/20">
          <AvatarImage 
            src="/lovable-uploads/3f275134-f471-4af9-a7cd-700ccd855fe3.png" 
            alt="Ruh"
            className="bg-primary/10 object-cover"
            loading="eager"
          />
          <AvatarFallback className="bg-primary/10 text-primary">
            <TranslatableText text="R" forceTranslate={true} />
          </AvatarFallback>
        </Avatar>
      )}
      
      <div
        className={cn(
          "max-w-[85%] md:max-w-[75%] rounded-2xl p-4 text-sm md:text-base shadow-sm",
          message.role === 'user' 
            ? 'bg-primary text-primary-foreground rounded-tr-none' 
            : 'bg-muted/60 border border-border/50 rounded-tl-none'
        )}
        data-role={message.role}
      >
        {message.role === 'assistant' ? (
          <TranslatableMarkdown className="prose dark:prose-invert prose-sm md:prose-base max-w-none" forceTranslate={true}>
            {formattedContent}
          </TranslatableMarkdown>
        ) : (
          <TranslatableText text={message.content} forceTranslate={true} />
        )}
        
        {/* Interactive options for clarification questions */}
        {hasInteractiveOptions && (
          <div className="mt-4 flex flex-col gap-2">
            {message.interactiveOptions.map((option, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="text-left justify-start h-auto py-2"
                onClick={() => onInteractiveOptionClick && onInteractiveOptionClick(option)}
              >
                <TranslatableText text={option.text} forceTranslate={true} />
              </Button>
            ))}
          </div>
        )}
        
        {showAnalysis && message.role === 'assistant' && message.analysis && (
          <div className="mt-3 text-xs md:text-sm opacity-80">
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
                <pre className={`${isMobile ? 'text-[10px]' : 'text-xs'} bg-black/10 p-1 rounded overflow-x-auto`}>
                  {message.analysis.sqlQuery}
                </pre>
              </>
            )}
          </div>
        )}
        
        {/* Display ambiguity info when in debug/analysis mode */}
        {showAnalysis && message.role === 'assistant' && hasAmbiguityInfo && (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-7 text-xs md:text-sm font-medium flex items-center gap-1 text-muted-foreground"
              onClick={() => setShowAmbiguityInfo(!showAmbiguityInfo)}
            >
              <TranslatableText 
                text={`Ambiguity Analysis (${message.ambiguityInfo.ambiguityType})`}
                forceTranslate={true}
              />
              {showAmbiguityInfo ? (
                <ChevronUp className="h-3 w-3 md:h-4 md:w-4 ml-1" />
              ) : (
                <ChevronDown className="h-3 w-3 md:h-4 md:w-4 ml-1" />
              )}
            </Button>
            
            <AnimatePresence>
              {showAmbiguityInfo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 border-l-2 border-primary/30 pl-3 pr-1 text-xs"
                >
                  <div>
                    <span className="font-medium">Type:</span> {message.ambiguityInfo.ambiguityType}
                  </div>
                  <div className="mt-1">
                    <span className="font-medium">Original Reasoning:</span> {message.ambiguityInfo.reasoning}
                  </div>
                  {message.ambiguityInfo.suggestedClarificationQuestions && (
                    <div className="mt-1">
                      <span className="font-medium">Suggested Questions:</span>
                      <ul className="pl-4 mt-1 list-disc">
                        {message.ambiguityInfo.suggestedClarificationQuestions.map((q: string, idx: number) => (
                          <li key={idx}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        
        {showAnalysis && message.role === 'assistant' && message.diagnostics && renderDiagnostics(message.diagnostics, isMobile)}
        
        {message.role === 'assistant' && message.references && message.references.length > 0 && (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-7 text-xs md:text-sm font-medium flex items-center gap-1 text-muted-foreground"
              onClick={() => setShowReferences(!showReferences)}
            >
              <FileText className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              <TranslatableText 
                text={`${message.references.length} journal entries`}
                forceTranslate={true}
              />
              {showReferences ? (
                <ChevronUp className="h-3 w-3 md:h-4 md:w-4 ml-1" />
              ) : (
                <ChevronDown className="h-3 w-3 md:h-4 md:w-4 ml-1" />
              )}
            </Button>
            
            <AnimatePresence>
              {showReferences && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 max-h-40 md:max-h-60 overflow-y-auto border-l-2 border-primary/30 pl-3 pr-1"
                >
                  {message.references.slice(0, isMobile ? 2 : 3).map((ref, idx) => (
                    <div key={idx} className="mb-2 py-1">
                      <div className="font-medium text-xs md:text-sm">
                        {ref.date && !isNaN(new Date(ref.date).getTime())
                          ? formatShortDate(new Date(ref.date))
                          : <TranslatableText text="Unknown date" forceTranslate={true} />}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        <TranslatableText text={ref.snippet} forceTranslate={true} />
                      </div>
                    </div>
                  ))}
                  {message.references.length > (isMobile ? 2 : 3) && (
                    <div className="text-xs text-muted-foreground">
                      <TranslatableText 
                        text={`+${message.references.length - (isMobile ? 2 : 3)} more entries`}
                        forceTranslate={true}
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      
      {message.role === 'user' && (
        <Avatar className="h-10 w-10 border border-primary/20">
          <AvatarImage 
            src={user?.user_metadata?.avatar_url} 
            alt="User"
            className="bg-primary/20"
            loading="eager"
          />
          <AvatarFallback className="bg-primary/20 text-primary">
            {user?.user_metadata?.full_name ? 
              user.user_metadata.full_name.charAt(0) : 
              user?.email?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
      )}
    </motion.div>
  );
};

// Extracted this function to keep the main component cleaner
const renderDiagnostics = (diagnostics: any, isMobile: boolean) => {
  if (!diagnostics) return null;
  
  return (
    <div className="mt-3 text-xs">
      <Separator className="my-2" />
      <div className="font-semibold">
        <TranslatableText text="Query Diagnostics:" forceTranslate={true} />
      </div>
      <div className={`max-h-40 md:max-h-60 overflow-y-auto mt-1 bg-slate-800 p-2 rounded text-slate-200 ${isMobile ? 'text-[9px]' : 'text-xs'}`}>
        {diagnostics.query_plan && (
          <div>
            <div className="font-medium">
              <TranslatableText text="Sample Answer:" forceTranslate={true} />
            </div>
            <div className="text-xs whitespace-pre-wrap mb-2">{diagnostics.query_plan.sample_answer}</div>
            
            {!isMobile && (
              <>
                <div className="font-medium">
                  <TranslatableText text="Execution Plan:" forceTranslate={true} />
                </div>
                {diagnostics.query_plan.execution_plan.map((segment: any, idx: number) => (
                  <div key={idx} className="mb-2 border-l-2 border-blue-500 pl-2">
                    <div><span className="font-medium">
                      <TranslatableText text="Segment:" forceTranslate={true} />
                    </span> {segment.segment}</div>
                    <div><span className="font-medium">
                      <TranslatableText text="Type:" forceTranslate={true} />
                    </span> {segment.segment_type}</div>
                    {segment.sql_query && (
                      <div>
                        <span className="font-medium">
                          <TranslatableText text="SQL:" forceTranslate={true} />
                        </span>
                        <pre className="text-xs overflow-x-auto">{segment.sql_query}</pre>
                      </div>
                    )}
                    {segment.vector_search && (
                      <div><span className="font-medium">
                        <TranslatableText text="Vector Search:" forceTranslate={true} />
                      </span> {segment.vector_search}</div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        
        {!isMobile && diagnostics.execution_results && (
          <div className="mt-2">
            <div className="font-medium">
              <TranslatableText text="Execution Results:" forceTranslate={true} />
            </div>
            {diagnostics.execution_results.execution_results.map((result: any, idx: number) => (
              <div key={idx} className="mb-2 border-l-2 border-green-500 pl-2">
                <div><span className="font-medium">
                  <TranslatableText text="Segment:" forceTranslate={true} />
                </span> {result.segment}</div>
                <div><span className="font-medium">
                  <TranslatableText text="Type:" forceTranslate={true} />
                </span> {result.type}</div>
                {result.error ? (
                  <div className="text-red-400"><span className="font-medium">
                    <TranslatableText text="Error:" forceTranslate={true} />
                  </span> {result.error}</div>
                ) : (
                  <div>
                    <span className="font-medium">
                      <TranslatableText text="Result:" forceTranslate={true} />
                    </span>
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
