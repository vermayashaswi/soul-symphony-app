
export async function transcribeAudioWithWhisper(
  audioBlob: Blob,
  fileExtension: string,
  apiKey: string,
  language: string = 'en'
): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${fileExtension}`);
    formData.append('model', 'gpt-4o-mini-transcribe');  // Using gpt-4o-mini-transcribe model
    formData.append('language', language);
    formData.append('response_format', 'json');
    formData.append('prompt', 'The following is a journal entry or conversation that may contain personal thoughts, feelings, or experiences.');
    
    console.log('[Transcription] Sending request to OpenAI with:', {
      fileSize: audioBlob.size,
      fileType: audioBlob.type,
      fileExtension,
      language,
      hasApiKey: !!apiKey,
      model: 'gpt-4o-mini-transcribe'
    });
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Transcription] API error:', errorText);
      throw new Error(`Transcription API error: ${response.status} - ${errorText}`);
    }
    
    // Note: gpt-4o-mini-transcribe only supports json or text response formats
    const result = await response.json();
    
    if (!result.text) {
      console.error('[Transcription] No text in response:', result);
      throw new Error('No transcription text returned from API');
    }
    
    console.log('[Transcription] Success:', {
      textLength: result.text.length,
      sampleText: result.text.substring(0, 100) + '...',
      model: 'gpt-4o-mini-transcribe'
    });
    
    return result.text;
  } catch (error) {
    console.error('[Transcription] Error in transcribeAudioWithWhisper:', error);
    throw error;
  }
}
