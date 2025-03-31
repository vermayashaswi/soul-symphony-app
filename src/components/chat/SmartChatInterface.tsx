import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send, Mic, BarChart4 } from "lucide-react";
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
    references?: any[];
    diagnostics?: any;
  }[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
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
      console.log("Using smart-query-planner for message:", userMessage);
      
      try {
        const { data, error } = await supabase.functions.invoke('smart-query-planner', {
          body: {
            message: userMessage,
            userId: user!.id,
            includeDiagnostics: true
          }
        });
        
        if (error) {
          console.error("Error from smart-query-planner:", error);
          throw error;
        }
        
        console.log("Smart query planner response:", data);
        
        setChatHistory(prev => [
          ...prev, 
          { 
            role: 'assistant', 
            content: data.response,
            diagnostics: data.diagnostics
          }
        ]);
        
        return;
      } catch (smartQueryError) {
        console.error("Smart query planner failed, falling back to smart-chat:", smartQueryError);
      }
      
      console.log("Falling back to smart-chat with query types:", queryTypes);
      
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
          analysis: data.analysis,
          references: data.references,
          diagnostics: data.diagnostics
        }
      ]);
      
      if (data.diagnostics) {
        console.log("Chat diagnostics:", data.diagnostics);
      }
      
      if (data.queryAnalysis) {
        console.log("Query analysis:", data.queryAnalysis);
      }
      
      if (data.statisticsData) {
        console.log("Statistics data:", data.statisticsData);
      }
    } catch (error) {
      throw error;
    }
  };

  const analyzeQueryTypes = (query: string): Record<string, boolean> => {
    const lowerQuery = query.toLowerCase();
    
    const quantitativeWords = [
      'how many', 'how much', 'count', 'total', 'average', 'avg', 'statistics',
      'stats', 'number', 'percentage', 'percent', 'ratio', 'frequency', 'score',
      'rate', 'top', 'bottom', 'most', 'least', 'highest', 'lowest', 'ranking',
      'rank', 'distribution', 'mean', 'median', 'majority', 'out of', 'scale'
    ];
    
    const comparativeWords = [
      'more than', 'less than', 'greater', 'smaller', 'better', 'worse', 'between',
      'compared to', 'versus', 'vs', 'difference', 'similar', 'most', 'least',
      'highest', 'lowest', 'top', 'bottom', 'maximum', 'minimum', 'max', 'min',
      'best', 'worst', 'stronger', 'weaker', 'dominant', 'primary', 'secondary'
    ];
    
    const temporalWords = [
      'when', 'time', 'date', 'period', 'duration', 'during', 'after', 'before',
      'since', 'until', 'day', 'week', 'month', 'year', 'today', 'yesterday',
      'tomorrow', 'recent', 'last', 'this', 'next', 'previous', 'upcoming',
      'now', 'past', 'future', 'earlier', 'later', 'history', 'trend'
    ];
    
    const emotionWords = [
      'feel', 'feeling', 'emotion', 'mood', 'happy', 'sad', 'angry', 'anxious',
      'joyful', 'excited', 'disappointed', 'frustrated', 'content', 'hopeful',
      'grateful', 'proud', 'afraid', 'scared', 'worried', 'stressed', 'peaceful',
      'calm', 'love', 'hate', 'fear', 'disgust', 'surprise', 'shame', 'guilt',
      'positive', 'negative', 'neutral'
    ];
    
    const numberWordPatterns = [
      /\b\d+\b/, /\bone\b/, /\btwo\b/, /\bthree\b/, /\bfour\b/, /\bfive\b/,
      /\bsix\b/, /\bseven\b/, /\beight\b/, /\bnine\b/, /\bten\b/, /\bdozen\b/,
      /\bhundred\b/, /\bthousand\b/, /\bmillion\b/, /\bbillion\b/, /\btrillion\b/,
      /\bfirst\b/, /\bsecond\b/, /\bthird\b/, /\blast\b/, /\bhalf\b/, /\btwice\b/,
      /\bdouble\b/, /\btriple\b/, /\bquadruple\b/, /\bquintuple\b/, /\bmultiple\b/
    ];
    
    const topEmotionsPattern = /top\s+\d+\s+(positive|negative)\s+emotions/i;
    
    const hasQuantitativeWords = quantitativeWords.some(word => 
      lowerQuery.includes(word)
    );
    
    const hasNumbers = numberWordPatterns.some(pattern => 
      pattern.test(lowerQuery)
    );
    
    const hasComparativeWords = comparativeWords.some(word => 
      lowerQuery.includes(word)
    );
    
    const hasTemporalWords = temporalWords.some(word => 
      new RegExp(`\\b${word}\\b`).test(lowerQuery)
    );
    
    const hasEmotionWords = emotionWords.some(word => 
      new RegExp(`\\b${word}\\b`).test(lowerQuery)
    );
    
    const hasTopEmotionsPattern = topEmotionsPattern.test(lowerQuery);
    
    const needsContext = /\bwhy\b|\breason\b|\bcause\b|\bexplain\b|\bunderstand\b|\bmeaning\b|\binterpret\b/.test(lowerQuery);
    
    return {
      isQuantitative: hasQuantitativeWords || hasNumbers || hasTopEmotionsPattern,
      
      isTemporal: hasTemporalWords,
      
      isComparative: hasComparativeWords || hasTopEmotionsPattern,
      
      isEmotionFocused: hasEmotionWords || hasTopEmotionsPattern,
      
      hasTopEmotionsPattern,
      
      needsContext: needsContext,
      
      asksForNumber: hasNumbers || hasTopEmotionsPattern || /how many|how much|what percentage|how often|frequency|count|number of/i.test(lowerQuery),
      
      needsVectorSearch: true
    };
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

  const toggleAnalysis = () => {
    setShowAnalysis(!showAnalysis);
  };

  const renderReferences = (references: any[]) => {
    if (!references || references.length === 0) return null;
    
    return (
      <div className="mt-2 text-xs">
        <Separator className="my-2" />
        <div className="font-semibold">Based on {references.length} journal entries:</div>
        <div className="max-h-40 overflow-y-auto mt-1">
          {references.slice(0, 3).map((ref, idx) => (
            <div key={idx} className="mt-1 border-l-2 border-primary pl-2 py-1">
              <div className="font-medium">{new Date(ref.date).toLocaleDateString()}</div>
              <div className="text-muted-foreground">{ref.snippet}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDiagnostics = (diagnostics: any) => {
    if (!diagnostics) return null;
    
    return (
      <div className="mt-2 text-xs">
        <Separator className="my-2" />
        <div className="font-semibold">Query Diagnostics:</div>
        <div className="max-h-60 overflow-y-auto mt-1 bg-slate-800 p-2 rounded text-slate-200">
          {diagnostics.query_plan && (
            <div>
              <div className="font-medium">Sample Answer:</div>
              <div className="text-xs whitespace-pre-wrap mb-2">{diagnostics.query_plan.sample_answer}</div>
              
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
            </div>
          )}
          
          {diagnostics.execution_results && (
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

  return (
    <Card className="smart-chat-interface w-full max-w-3xl mx-auto h-[calc(70vh)] md:h-[80vh] flex flex-col">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-center">Smart Chat</CardTitle>
        {chatHistory.length > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleAnalysis}
            className="flex items-center gap-1"
          >
            <BarChart4 className="h-4 w-4" />
            {showAnalysis ? "Hide Analysis" : "Show Analysis"}
          </Button>
        )}
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
                <li>"My top 3 positive and negative emotions?"</li>
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
                
                {showAnalysis && msg.role === 'assistant' && msg.analysis && (
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
                
                {showAnalysis && msg.role === 'assistant' && msg.diagnostics && renderDiagnostics(msg.diagnostics)}
                
                {msg.role === 'assistant' && msg.references && renderReferences(msg.references)}
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
