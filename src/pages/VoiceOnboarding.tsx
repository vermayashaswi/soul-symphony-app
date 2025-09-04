import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Volume2, SkipForward } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface OnboardingData {
  age_range?: string;
  interests?: string[];
  journaling_goals?: string[];
  wellness_goals?: string[];
  preferred_topics?: string[];
  communication_style?: string;
}

interface ConversationStep {
  question: string;
  dataKey: keyof OnboardingData;
  type: 'single' | 'multiple' | 'text';
}

const CONVERSATION_STEPS: ConversationStep[] = [
  {
    question: "Hi there! I'm your journaling companion. Let's get to know each other better. What's your age range?",
    dataKey: 'age_range',
    type: 'single'
  },
  {
    question: "Great! What are your main interests or hobbies? Feel free to mention multiple things.",
    dataKey: 'interests',
    type: 'multiple'
  },
  {
    question: "What brings you to journaling? What are you hoping to achieve through writing?",
    dataKey: 'journaling_goals',
    type: 'multiple'
  },
  {
    question: "What are your wellness or personal development goals?",
    dataKey: 'wellness_goals',
    type: 'multiple'
  },
  {
    question: "What topics would you like me to focus on when analyzing your journal entries?",
    dataKey: 'preferred_topics',
    type: 'multiple'
  }
];

const VoiceOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentQuestion = CONVERSATION_STEPS[currentStep];

  // Mascot animation states
  const getMascotAnimation = () => {
    if (isPlaying) return 'animate-bounce';
    if (isRecording) return 'animate-pulse';
    return '';
  };

  const speakText = async (text: string) => {
    try {
      setIsPlaying(true);
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text, voice: 'alloy' }
      });

      if (error) throw error;

      if (data.audioContent) {
        const audioData = atob(data.audioContent);
        const arrayBuffer = new ArrayBuffer(audioData.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        
        for (let i = 0; i < audioData.length; i++) {
          uint8Array[i] = audioData.charCodeAt(i);
        }

        const audioBlob = new Blob([arrayBuffer], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
      }
    } catch (error) {
      console.error('Text-to-speech error:', error);
      setIsPlaying(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      audioContextRef.current = new AudioContext();
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudioTranscription(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const processAudioTranscription = async (audioBlob: Blob) => {
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        const { data, error } = await supabase.functions.invoke('transcribe-chat-audio', {
          body: { audio: base64Audio }
        });

        if (error) throw error;

        const transcription = data.text?.trim();
        if (transcription) {
          await handleUserResponse(transcription);
        } else {
          toast({
            title: "No speech detected",
            description: "Please try speaking again.",
            variant: "destructive"
          });
        }
        setIsProcessing(false);
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Transcription error:', error);
      setIsProcessing(false);
      toast({
        title: "Transcription Error",
        description: "Could not process your response. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleUserResponse = async (response: string) => {
    const { dataKey, type } = currentQuestion;
    
    // Process response based on type
    let processedResponse: any = response;
    if (type === 'multiple') {
      // Simple keyword extraction for multiple items
      processedResponse = response.split(/[,\s]+and\s+|[,]\s*/).filter(item => item.trim().length > 0);
    }

    setOnboardingData(prev => ({
      ...prev,
      [dataKey]: processedResponse
    }));

    // Move to next step or complete
    if (currentStep < CONVERSATION_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
      // Auto-play next question after a short delay
      setTimeout(() => {
        speakText(CONVERSATION_STEPS[currentStep + 1].question);
      }, 1000);
    } else {
      await completeOnboarding();
    }
  };

  const completeOnboarding = async () => {
    try {
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          onboarding_data: onboardingData as any,
          voice_onboarding_completed: true
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Onboarding Complete!",
        description: "Thank you for sharing. Let's start your journaling journey!",
      });

      // Navigate to main app
      navigate('/app');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({
        title: "Error",
        description: "Failed to save your information. Please try again.",
        variant: "destructive"
      });
    }
  };

  const skipStep = () => {
    if (currentStep < CONVERSATION_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
      setTimeout(() => {
        speakText(CONVERSATION_STEPS[currentStep + 1].question);
      }, 500);
    } else {
      completeOnboarding();
    }
  };

  const skipOnboarding = () => {
    navigate('/app');
  };

  // Auto-play first question on mount
  useEffect(() => {
    setTimeout(() => {
      speakText(currentQuestion.question);
    }, 1000);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8 space-y-8 backdrop-blur-sm bg-card/95">
        {/* Progress indicator */}
        <div className="w-full bg-secondary/30 rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${((currentStep + 1) / CONVERSATION_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Mascot */}
        <div className="flex justify-center">
          <div className={`w-32 h-32 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center ${getMascotAnimation()}`}>
            <div className="text-6xl">🤖</div>
          </div>
        </div>

        {/* Question */}
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            {currentQuestion.question}
          </h2>
          <p className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {CONVERSATION_STEPS.length}
          </p>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          {!isRecording && !isProcessing && (
            <>
              <Button 
                onClick={startRecording}
                size="lg"
                className="flex items-center gap-2"
              >
                <Mic className="w-5 h-5" />
                Speak
              </Button>
              <Button 
                onClick={() => speakText(currentQuestion.question)}
                variant="outline"
                size="lg"
                disabled={isPlaying}
                className="flex items-center gap-2"
              >
                <Volume2 className="w-5 h-5" />
                Repeat
              </Button>
            </>
          )}

          {isRecording && (
            <Button 
              onClick={stopRecording}
              variant="destructive"
              size="lg"
              className="flex items-center gap-2 animate-pulse"
            >
              <MicOff className="w-5 h-5" />
              Stop Recording
            </Button>
          )}

          {isProcessing && (
            <Button disabled size="lg">
              Processing...
            </Button>
          )}
        </div>

        {/* Skip options */}
        <div className="flex justify-between text-sm">
          <Button variant="ghost" onClick={skipStep} className="flex items-center gap-2">
            <SkipForward className="w-4 h-4" />
            Skip this question
          </Button>
          <Button variant="ghost" onClick={skipOnboarding}>
            Skip onboarding
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default VoiceOnboarding;