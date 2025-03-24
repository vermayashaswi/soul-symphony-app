
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface UseTranscriptionReturnType {
  transcription: string | null;
  isTranscribing: boolean;
  transcribeAudio: (audioBlob: Blob) => Promise<void>;
  resetTranscription: () => void;
  refinedText: string | null;
  emotions: string[] | null;
  refineTranscription: (text: string) => Promise<void>;
  isRefiningTranscription: boolean;
}

export function useTranscription(): UseTranscriptionReturnType {
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [refinedText, setRefinedText] = useState<string | null>(null);
  const [emotions, setEmotions] = useState<string[] | null>(null);
  const [isRefiningTranscription, setIsRefiningTranscription] = useState(false);

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true);
      
      // Create a FormData object to send the audio file
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      
      // Call the Supabase Edge Function to transcribe the audio
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: formData,
      });
      
      if (error) {
        console.error('Error transcribing audio:', error);
        toast.error('Failed to transcribe audio');
        throw error;
      }
      
      if (data?.text) {
        setTranscription(data.text);
        toast.success('Audio transcribed successfully');
      } else {
        toast.error('No transcription returned');
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      toast.error('Failed to transcribe audio');
    } finally {
      setIsTranscribing(false);
    }
  };

  const refineTranscription = async (text: string) => {
    try {
      setIsRefiningTranscription(true);
      
      // Call the Supabase Edge Function to analyze sentiment and refine text
      const { data, error } = await supabase.functions.invoke('analyze-sentiment', {
        body: { text }
      });
      
      if (error) {
        console.error('Error refining transcription:', error);
        toast.error('Failed to analyze your journal entry');
        throw error;
      }
      
      if (data) {
        setRefinedText(data.refinedText || null);
        setEmotions(data.emotions || null);
        toast.success('Journal entry refined with AI');
      }
    } catch (error) {
      console.error('Error refining transcription:', error);
      toast.error('Failed to analyze your journal entry');
    } finally {
      setIsRefiningTranscription(false);
    }
  };

  const resetTranscription = () => {
    setTranscription(null);
    setRefinedText(null);
    setEmotions(null);
  };

  return {
    transcription,
    isTranscribing,
    transcribeAudio,
    resetTranscription,
    refinedText,
    emotions,
    refineTranscription,
    isRefiningTranscription
  };
}
