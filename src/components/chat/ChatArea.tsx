
import React, { useRef, useEffect, useState } from "react";
import { ChatMessage } from "@/services/chat";
import ChatMessageItem from "./ChatMessageItem";
import ChatTypingIndicator from "./ChatTypingIndicator";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";

interface ChatAreaProps {
  chatMessages: ChatMessage[];
  isLoading: boolean;
  processingStage?: string;
  threadId: string | null;
  plannerResults?: any;
}

const ChatArea: React.FC<ChatAreaProps> = ({ 
  chatMessages, 
  isLoading, 
  processingStage,
  threadId,
  plannerResults
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [openPlannerDetails, setOpenPlannerDetails] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [chatMessages, isLoading]);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isScrolledToBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50;
      
      setIsAtBottom(isScrolledToBottom);
      setShowScrollButton(!isScrolledToBottom);
    };
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
  };

  return (
    <div className="relative h-full flex flex-col">
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent" 
      >
        {chatMessages.map((message, index) => (
          <ChatMessageItem 
            key={message.id || index} 
            message={message}
            isLastMessage={index === chatMessages.length - 1}
            threadId={threadId}
          />
        ))}
        
        {isLoading && (
          <ChatTypingIndicator stage={processingStage} />
        )}
        
        {plannerResults && (
          <Collapsible
            open={openPlannerDetails}
            onOpenChange={setOpenPlannerDetails}
            className="w-full mt-4 border rounded-lg overflow-hidden"
          >
            <div className="bg-secondary/50 px-4 py-2 flex justify-between items-center">
              <div className="text-sm font-medium">Planner Analysis Details</div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <ChevronDown className={`h-4 w-4 transition-transform ${openPlannerDetails ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="p-4 bg-secondary/20">
              <div className="space-y-4">
                {plannerResults.planDetails?.steps && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Execution Plan</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs space-y-2">
                        {plannerResults.planDetails.steps.map((step, index) => (
                          <div key={index} className="border-l-2 border-primary pl-2 py-1">
                            <div className="font-medium">{step.name}</div>
                            <div className="text-muted-foreground mt-1">
                              {Object.entries(step.arguments || {}).map(([key, value]) => (
                                <div key={key} className="flex">
                                  <span className="w-24 font-mono">{key}:</span>
                                  <span>{JSON.stringify(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {plannerResults.executionResults && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Execution Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs space-y-3">
                        {plannerResults.executionResults.map((result, index) => (
                          <div key={index} className="border p-2 rounded">
                            <div className="font-medium mb-1">{result.stepName}</div>
                            <div className="text-muted-foreground">
                              {result.error ? (
                                <div className="text-red-500">{result.error}</div>
                              ) : (
                                <div>Found {Array.isArray(result.result) ? result.result.length : 0} results</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {showScrollButton && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-4 right-4 rounded-full shadow-md"
          onClick={scrollToBottom}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default ChatArea;
