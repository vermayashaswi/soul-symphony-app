
export async function transcribeAudioWithWhisper(
  audioBlob: Blob,
  fileExtension: string,
  apiKey: string,
  language: string = 'en'
): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${fileExtension}`);
    formData.append('model', 'whisper-1');  // Corrected model name
    formData.append('language', language);
    formData.append('response_format', 'json');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Transcription API error:', errorText);
      throw new Error(`Transcription API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    return result.text || '';
  } catch (error) {
    console.error('Error in transcribeAudioWithWhisper:', error);
    throw error;
  }
}
