
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

let apiKeySet = false;

export const ensureOpenAIApiKey = async (): Promise<boolean> => {
  if (apiKeySet) {
    return true;
  }
  
  try {
    // Your OpenAI API key
    const openaiKey = "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";
    
    const { data, error } = await supabase.functions.invoke('set-api-key', {
      body: {
        key: 'OPENAI_API_KEY',
        value: openaiKey
      }
    });
    
    if (error) {
      console.error('Error setting OpenAI API key:', error);
      toast.error('Failed to set OpenAI API key. Voice processing may not work.');
      return false;
    }
    
    if (data.success) {
      console.log('OpenAI API key set successfully');
      apiKeySet = true;
      return true;
    } else {
      console.error('Failed to set OpenAI API key:', data.error);
      toast.error('Failed to set OpenAI API key. Voice processing may not work.');
      return false;
    }
  } catch (error) {
    console.error('Error setting OpenAI API key:', error);
    toast.error('Failed to set OpenAI API key. Voice processing may not work.');
    return false;
  }
};
