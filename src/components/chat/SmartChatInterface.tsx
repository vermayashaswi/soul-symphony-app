
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send, Mic } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from 'react-markdown';
import { sendAudioForTranscription } from "@/utils/audio/transcription-service";

export default function SmartChatInterface() {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [chatHistory, setChatHistory] = useState<{
    role: 'user' | 'assistant';
    content: string;
    analysis?: any;
  }[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  // Function to handle voice input
  const handleVoiceInput = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to use voice input.",
        variant: "destructive"
      });
      return;
    }

    try {
      if (isRecording) {
        setIsRecording(false);
        return;
      }

      setIsRecording(true);
      
      // Start recording
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false, // Changed from true to false
          noiseSuppression: false, // Changed from true to false
          autoGainControl: true,
          // Use higher sample rate for better quality
          sampleRate: 48000,
          // Try to use higher bit depth
          sampleSize: 24,
          // Use stereo if available
          channelCount: 2,
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: BlobPart[] = [];
      
      mediaRecorder.addEventListener("dataavailable", (event) => {
        audioChunks.push(event.data);
      });
      
      mediaRecorder.addEventListener("stop", async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // Convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64String = reader.result as string;
          // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
          const base64Data = base64String.split(',')[1];
          
          setIsLoading(true);
          const result = await sendAudioForTranscription(base64Data, user.id);
          
          if (result.success && result.data?.transcription) {
            const transcription = result.data.transcription;
            setMessage(transcription);
            
            // Auto-submit the transcribed message
            handleSubmitTranscription(transcription);
          } else {
            toast({
              title: "Transcription failed",
              description: result.error || "Failed to transcribe audio. Try speaking clearly and try again.",
              variant: "destructive"
            });
            setIsLoading(false);
          }
          
          setIsRecording(false);
        };
      });
      
      // Start recording for 15 seconds maximum
      mediaRecorder.start();
      
      setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
          stream.getTracks().forEach(track => track.stop());
        }
      }, 15000);
      
      toast({
        title: "Recording started",
        description: "Recording for up to 15 seconds. Speak clearly.",
      });
      
    } catch (error) {
      console.error("Error recording audio:", error);
      toast({
        title: "Recording error",
        description: "Could not access microphone. Check browser permissions.",
        variant: "destructive"
      });
      setIsRecording(false);
      setIsLoading(false);
    }
  };

  const handleSubmitTranscription = async (transcription: string) => {
    // Reuse the existing submit function but with the transcription as input
    if (!transcription.trim()) {
      setIsLoading(false);
      return;
    }
    
    // Add user message to chat history
    setChatHistory(prev => [...prev, { role: 'user', content: transcription }]);
    setIsLoading(true);
    
    try {
      await processChatMessage(transcription);
    } catch (error) {
      handleChatError(error);
    } finally {
      setIsLoading(false);
    }
  };

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
    
    // Add user message to chat history
    setChatHistory(prev => [...prev, { role: 'user', content: message }]);
    const userMessage = message;
    setMessage("");
    setIsLoading(true);
    
    try {
      await processChatMessage(userMessage);
    } catch (error) {
      handleChatError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const processChatMessage = async (userMessage: string) => {
    const isQuantitativeQuery = checkForQuantitativeQuery(userMessage);
    
    try {
      const { data, error } = await supabase.functions.invoke('smart-chat', {
        body: {
          message: userMessage,
          userId: user!.id,
          includeDiagnostics: true,
          isQuantitativeQuery // Pass this flag to the function
        }
      });
      
      if (error) throw error;
      
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
    } catch (error) {
      throw error; // Rethrow for the main handler
    }
  };

  // Helper function to check if the query is quantitative
  const checkForQuantitativeQuery = (query: string): boolean => {
    const quantitativePatterns = [
      /score/i, 
      /rate/i, 
      /average/i, 
      /how much/i, 
      /how many/i, 
      /percentage/i, 
      /quantity/i, 
      /count/i,
      /times/i,
      /frequency/i,
      /sentiment score/i,
      /emotion score/i,
      /out of 10/i,
      /out of ten/i,
      /statistics/i,
      /stats/i
    ];
    
    return quantitativePatterns.some(pattern => pattern.test(query));
  };

  const handleChatError = (error: any) => {
    console.error("Error sending message:", error);
    toast({
      title: "Error",
      description: "Failed to get a response. Please try again.",
      variant: "destructive"
    });
    
    // Add error message to chat history
    setChatHistory(prev => [
      ...prev, 
      { 
        role: 'assistant', 
        content: "I'm having trouble processing your request. Please try again later."
      }
    ]);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto h-[80vh] flex flex-col">
      <CardHeader>
        <CardTitle className="text-center">Smart Chat</CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.length === 0 ? (
          <div className="text-center text-muted-foreground p-8">
            Start a conversation with your journal by asking a question.
          </div>
        ) : (
          chatHistory.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
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
                    <p>{msg.analysis.analysis}</p>
                    {msg.analysis.requiresSql && (
                      <>
                        <div className="font-semibold mt-1">SQL Query:</div>
                        <pre className="text-xs bg-black/10 p-1 rounded overflow-x-auto">
                          {msg.analysis.sqlQuery}
                        </pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
            disabled={isLoading || isRecording}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <div className="flex flex-col gap-2">
            <Button 
              type="button" 
              size="icon" 
              variant={isRecording ? "destructive" : "outline"}
              onClick={handleVoiceInput}
              disabled={isLoading}
            >
              <Mic className={`h-5 w-5 ${isRecording ? 'animate-pulse' : ''}`} />
            </Button>
            <Button type="submit" size="icon" disabled={isLoading || isRecording || !message.trim()}>
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </form>
      </CardFooter>
    </Card>
  );
}
