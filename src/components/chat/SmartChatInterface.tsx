
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
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { useIsMobile } from "@/hooks/use-mobile";

export default function SmartChatInterface() {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);
  const [chatHistory, setChatHistory] = useState<{
    role: 'user' | 'assistant';
    content: string;
    analysis?: any;
  }[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  const [recorder, setRecorder] = useState<RecordRTC | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

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
        
        if (recordingTimer) {
          clearInterval(recordingTimer);
          setRecordingTimer(null);
        }
        setRecordingTime(0);
        
        if (recorder) {
          recorder.stopRecording(() => {
            const blob = recorder.getBlob();
            
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
              const base64String = reader.result as string;
              const base64Data = base64String.split(',')[1];
              
              setIsLoading(true);
              const result = await sendAudioForTranscription(base64Data, user.id);
              
              if (result.success && result.data?.transcription) {
                const transcription = result.data.transcription;
                setMessage(transcription);
                
                handleSubmitTranscription(transcription);
              } else {
                toast({
                  title: "Transcription failed",
                  description: result.error || "Failed to transcribe audio. Try speaking clearly and try again.",
                  variant: "destructive"
                });
                setIsLoading(false);
              }
            };
            
            if (stream) {
              stream.getTracks().forEach(track => track.stop());
              setStream(null);
            }
            
            setRecorder(null);
          });
        }
        
        return;
      }

      setIsRecording(true);
      setRecordingTime(0);
      
      const timer = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setRecordingTimer(timer);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 96000,
          sampleSize: 24,
          channelCount: 2,
        } 
      });
      
      setStream(mediaStream);
      
      const options = {
        type: 'audio',
        mimeType: 'audio/wav',
        recorderType: StereoAudioRecorder,
        numberOfAudioChannels: 2,
        desiredSampRate: 96000,
        checkForInactiveTracks: true,
        timeSlice: 50,
        audioBitsPerSecond: 320000,
      };
      
      const rtcRecorder = new RecordRTC(mediaStream, options);
      rtcRecorder.startRecording();
      setRecorder(rtcRecorder);
      
      toast({
        title: "Recording started",
        description: "Recording for up to 15 seconds. Speak clearly.",
      });
      
      setTimeout(() => {
        if (isRecording) {
          handleVoiceInput();
        }
      }, 15000);
      
    } catch (error) {
      console.error("Error recording audio:", error);
      toast({
        title: "Recording error",
        description: "Could not access microphone. Check browser permissions.",
        variant: "destructive"
      });
      setIsRecording(false);
      setIsLoading(false);
      
      if (recordingTimer) {
        clearInterval(recordingTimer);
        setRecordingTimer(null);
      }
      setRecordingTime(0);
    }
  };

  const handleSubmitTranscription = async (transcription: string) => {
    if (!transcription.trim()) {
      setIsLoading(false);
      return;
    }
    
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
    const queryTypes = analyzeQueryTypes(userMessage);
    
    try {
      const { data, error } = await supabase.functions.invoke('smart-chat', {
        body: {
          message: userMessage,
          userId: user!.id,
          includeDiagnostics: true,
          queryTypes
        }
      });
      
      if (error) throw error;
      
      setChatHistory(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: data.response, 
          analysis: data.analysis 
        }
      ]);
      
      if (data.diagnostics) {
        console.log("Chat diagnostics:", data.diagnostics);
      }
    } catch (error) {
      throw error;
    }
  };

  // Enhanced query analysis function
  const analyzeQueryTypes = (query: string): Record<string, boolean> => {
    const lowerQuery = query.toLowerCase();
    
    // Check for different query types
    return {
      // Quantitative patterns
      isQuantitative: checkForQuantitativeQuery(query),
      
      // Temporal patterns - when questions
      isTemporal: /\bwhen\b|\btime\b|\bdate\b|\bperiod\b|\bduring\b|\bafter\b|\bbefore\b/i.test(lowerQuery),
      
      // Comparative patterns - asking for most/least/top/bottom
      isComparative: /\bmost\b|\bleast\b|\btop\b|\bbottom\b|\bhighest\b|\blowest\b|\branking\b|\brank\b/i.test(lowerQuery),
      
      // Emotional analysis specific patterns
      isEmotionFocused: /\bfeel\b|\bfeeling\b|\bemotion\b|\bhappy\b|\bsad\b|\bangry\b|\bfear\b|\bjoy\b|\bworried\b|\banxious\b/i.test(lowerQuery),
      
      // Requiring context understanding
      needsContext: /\bwhy\b|\breason\b|\bcause\b|\bexplain\b|\bunderstand\b/i.test(lowerQuery),
      
      // Question asking for specific number 
      asksForNumber: /how many|how much|what percentage|how often|frequency|count/i.test(lowerQuery),
      
      // Standard vector search still needed
      needsVectorSearch: true
    };
  };

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
    
    setChatHistory(prev => [
      ...prev, 
      { 
        role: 'assistant', 
        content: "I'm having trouble processing your request. Please try again later."
      }
    ]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <Card className="smart-chat-interface w-full max-w-3xl mx-auto h-[calc(70vh)] md:h-[80vh] flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-center">Smart Chat</CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
        {chatHistory.length === 0 ? (
          <div className="text-center text-muted-foreground p-4 md:p-8">
            <p>Start a conversation with your journal by asking a question.</p>
            <div className="mt-4 text-sm">
              <p className="font-medium">Try questions like:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-left max-w-md mx-auto">
                <li>"How did I feel about work last week?"</li>
                <li>"What are my top 3 emotions in my journal?"</li>
                <li>"When was I feeling most anxious and why?"</li>
                <li>"What's the sentiment trend in my journal?"</li>
              </ul>
            </div>
          </div>
        ) : (
          chatHistory.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
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
      
      <CardFooter className="border-t p-3 md:p-4">
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
              className="relative"
            >
              <Mic className={`h-5 w-5 ${isRecording ? 'animate-pulse text-white' : ''}`} />
              {isRecording && (
                <span className="absolute -bottom-6 text-xs font-medium">
                  {formatTime(recordingTime)}
                </span>
              )}
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
