
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from 'react-markdown';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate, useLocation } from "react-router-dom";

export default function SmartChatInterface() {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<{
    role: 'user' | 'assistant' | 'error';
    content: string;
    analysis?: any;
  }[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isRequestActive, setIsRequestActive] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check that we're on the correct page
  useEffect(() => {
    if (location.pathname !== "/smart-chat" && isRequestActive) {
      console.log("Detected navigation away from smart-chat while request is active, returning");
      window.history.pushState(null, "", "/smart-chat");
    }
  }, [location.pathname, isRequestActive]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to use the chat feature.",
        variant: "destructive"
      });
      return;
    }
    
    // Clear any previous errors
    setApiError(null);
    
    // Add user message to chat history
    setChatHistory(prev => [...prev, { role: 'user', content: message }]);
    const userMessage = message;
    setMessage("");
    setIsLoading(true);
    setIsRequestActive(true);
    
    let timeoutId: number | null = null;
    
    try {
      console.log("Invoking chat-with-rag edge function");
      
      // Set a timeout to handle stuck requests
      timeoutId = window.setTimeout(() => {
        console.log("Request timed out after 30 seconds");
        setIsLoading(false);
        setIsRequestActive(false);
        setApiError("Request timed out after 30 seconds. Please try again.");
        setChatHistory(prev => [
          ...prev, 
          { 
            role: 'error', 
            content: "I'm having trouble connecting to the AI service. This might be due to high traffic or a temporary issue. Please try again in a moment."
          }
        ]);
        
        toast({
          title: "Request timed out",
          description: "The AI service is taking too long to respond. Please try again.",
          variant: "destructive"
        });
      }, 30000);
      
      console.log("Sending request to edge function");
      
      // Using the edge function with proper error handling
      const { data, error } = await supabase.functions.invoke('chat-with-rag', {
        body: {
          message: userMessage,
          userId: user.id,
          includeDiagnostics: true
        }
      });
      
      // Clear the timeout since we got a response
      if (timeoutId) {
        console.log("Clearing timeout, received response");
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      console.log("Response received:", data);
      
      if (error) {
        console.error("Error from edge function:", error);
        throw error;
      }
      
      // Add assistant response to chat history
      setChatHistory(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: data.response, 
          analysis: data.analysis 
        }
      ]);
      
      // Log diagnostics in console for debugging
      if (data.diagnostics) {
        console.log("Chat diagnostics:", data.diagnostics);
      }
      
    } catch (error: any) {
      console.error("Error sending message:", error);
      
      // Ensure timeout is cleared if there's an error
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Set specific error message based on the type of error
      let errorMessage = "Failed to get a response. Please try again.";
      
      if (error.message?.includes("timeout")) {
        errorMessage = "The request took too long to process. This might be due to issues with the AI service.";
      } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (error.message?.includes("authenticate")) {
        errorMessage = "Authentication error. Please sign in again.";
        // Don't redirect immediately, just show the error
      } else if (error.message?.includes("redirected") || error.name === "TypeError") {
        errorMessage = "Connection error. Please stay on this page while we process your request.";
        // Ensure we stay on this page and don't get redirected
        if (location.pathname !== "/smart-chat") {
          console.log("Detected unwanted redirect, returning to smart-chat");
          navigate("/smart-chat", { replace: true });
        }
      }
      
      console.log("Setting error message:", errorMessage);
      setApiError(errorMessage);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      
      // Add error message to chat history
      setChatHistory(prev => [
        ...prev, 
        { 
          role: 'error', 
          content: "I'm having trouble processing your request. This might be due to issues with the AI service or your journal data. Please try again later or try a different question."
        }
      ]);
    } finally {
      setIsLoading(false);
      setIsRequestActive(false);
    }
  };

  // Prevent accidental navigation away from this page during request
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRequestActive) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isRequestActive]);

  // Intercept history changes to prevent navigation during active requests
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isRequestActive) {
        console.log("Preventing navigation during active request");
        window.history.pushState(null, "", "/smart-chat");
        e.preventDefault();
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isRequestActive]);

  return (
    <Card className="w-full max-w-3xl mx-auto h-[80vh] flex flex-col">
      <CardHeader>
        <CardTitle className="text-center">Smart Chat</CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {apiError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {apiError}
            </AlertDescription>
          </Alert>
        )}
        
        {chatHistory.length === 0 ? (
          <div className="text-center text-muted-foreground p-8">
            Start a conversation with your journal by asking a question.
            <p className="mt-4 text-sm">
              Try asking things like:
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>When was I feeling jovial?</li>
                <li>What has been my top reason for happiness?</li>
                <li>What workplace issues make me feel sad?</li>
                <li>Out of all the times when I was extremely happy, when did I still fight with my partner?</li>
                <li>How have my emotions changed over the past month?</li>
              </ul>
            </p>
          </div>
        ) : (
          chatHistory.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : msg.role === 'error'
                      ? 'bg-destructive/10 text-destructive border border-destructive/20'
                      : 'bg-muted'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <ReactMarkdown className="prose dark:prose-invert prose-sm max-w-none">
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <p>{msg.content}</p>
                )}
                
                {msg.analysis && (
                  <div className="mt-2 text-xs opacity-70">
                    <Separator className="my-2" />
                    <div className="font-semibold">Analysis:</div>
                    <p>{JSON.stringify(msg.analysis)}</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Processing your request...</p>
            <p className="text-xs text-muted-foreground mt-1">Please don't leave this page</p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex w-full gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask about your journal entries..."
            className="flex-1 min-h-[60px] resize-none"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button type="submit" size="icon" disabled={isLoading || !message.trim()}>
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
