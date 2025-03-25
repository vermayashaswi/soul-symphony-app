
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
  storeEmbedding: (journalEntryId: number, text: string) => Promise<void>;
  isStoringEmbedding: boolean;
}

export function useTranscription(): UseTranscriptionReturnType {
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [refinedText, setRefinedText] = useState<string | null>(null);
  const [emotions, setEmotions] = useState<string[] | null>(null);
  const [isRefiningTranscription, setIsRefiningTranscription] = useState(false);
  const [isStoringEmbedding, setIsStoringEmbedding] = useState(false);

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

  // New function to store embeddings in the journal_embeddings table
  const storeEmbedding = async (journalEntryId: number, text: string) => {
    try {
      setIsStoringEmbedding(true);
      
      // Call the OpenAI embeddings API through a Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('create-embedding', {
        body: { text, journalEntryId },
      });
      
      if (error) {
        console.error('Error creating embedding:', error);
        toast.error('Failed to create embedding for journal entry');
        throw error;
      }
      
      if (data?.success) {
        console.log('Embedding stored successfully for journal entry:', journalEntryId);
        toast.success('Journal entry indexed for search');
      } else {
        console.error('No success response from embedding function');
        toast.error('Failed to index journal entry for search');
      }
    } catch (error) {
      console.error('Error storing embedding:', error);
      toast.error('Failed to index journal entry for search');
    } finally {
      setIsStoringEmbedding(false);
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
    isRefiningTranscription,
    storeEmbedding,
    isStoringEmbedding
  };
}
