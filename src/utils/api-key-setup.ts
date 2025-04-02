
import { toast } from 'sonner';

let openaiApiKey = "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";

export const getOpenAIApiKey = (): string => {
  return openaiApiKey;
};

export const ensureOpenAIApiKey = async (): Promise<boolean> => {
  try {
    // Perform a validation check on the key
    const response = await fetch('/api/set-api-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: 'OPENAI_API_KEY',
        value: openaiApiKey
      })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      console.error('Error validating OpenAI API key:', data.error);
      toast.error('Failed to validate OpenAI API key. Voice processing may not work.');
      return false;
    }
    
    console.log('OpenAI API key validated successfully');
    return true;
  } catch (error) {
    console.error('Error ensuring OpenAI API key:', error);
    toast.error('Failed to validate OpenAI API key. Voice processing may not work.');
    return false;
  }
};
