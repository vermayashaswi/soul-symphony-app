
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
      
      if (data?.transcription) {
        setTranscription(data.transcription);
        toast.success('Audio processing complete');
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

  // Simplified refineTranscription function without AI analysis
  const refineTranscription = async (text: string) => {
    try {
      setIsRefiningTranscription(true);
      
      // Simply set the refined text to be the same as the input text
      setRefinedText(text);
      
      // Set empty emotions array
      setEmotions([]);
      
      toast.success('Journal entry saved');
      
    } catch (error) {
      console.error('Error saving transcription:', error);
      toast.error('Failed to save your journal entry');
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
