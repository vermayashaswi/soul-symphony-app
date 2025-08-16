
// Import necessary Deno modules
import { encode as base64Encode } from "https://deno.land/std@0.132.0/encoding/base64.ts";

// Import the official OpenAI SDK
import OpenAI from "https://esm.sh/openai@4.63.0";

/**
 * Transcribe audio using OpenAI's Whisper API for chat purposes only
 * @param audioBlob - The audio blob to transcribe
 * @param fileType - The audio file type (webm, mp4, wav, etc.)
 * @param apiKey - The OpenAI API key
 * @param language - The language code or 'auto' for auto-detection
 * @returns Transcribed text only
 */
export async function transcribeAudioWithWhisper(
  audioBlob: Blob,
  fileType: string,
  apiKey: string,
  language: string = 'auto'
): Promise<{ text: string }> {
  try {
    console.log("[ChatTranscription] Starting Whisper transcription for chat");
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
    });
    
    // Determine the appropriate filename extension based on audio type
    const fileExtension = fileType === 'webm' ? 'webm' : 
                         fileType === 'mp4' ? 'm4a' :
                         fileType === 'wav' ? 'wav' : 'ogg';
    
    // Prepare the audio file with an appropriate name for the OpenAI API
    const filename = `audio.${fileExtension}`;
    console.log("[ChatTranscription] Using filename:", filename);
    
    // Convert the blob to an ArrayBuffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBytes = new Uint8Array(arrayBuffer);
    
    console.log("[ChatTranscription] Preparing audio for OpenAI:", {
      blobSize: audioBlob.size,
      blobType: audioBlob.type,
      fileExtension
    });
    
    // Create a File object from the audio data
    const audioFile = new File([audioBytes], filename, { type: audioBlob.type });
    
    // Enhanced retry logic with multiple model attempts
    const models = ["gpt-4o-transcribe"]; // Use the same model as journal
    let lastError: Error | null = null;
    
    for (const model of models) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[ChatTranscription] Attempt ${attempt}/3 with model: ${model}`);
          
          // Prepare transcription parameters
          const transcriptionParams: any = {
            file: audioFile,
            model: model,
            response_format: "json"
          };
          
          // Only add language parameter if it's not 'auto'
          if (language !== 'auto') {
            transcriptionParams.language = language;
          }
          
          console.log(`[ChatTranscription] Sending request to OpenAI with model ${model}:`, {
            fileSize: audioBlob.size,
            fileType: audioBlob.type,
            fileExtension,
            hasApiKey: !!apiKey,
            model: model,
            responseFormat: "json",
            autoLanguageDetection: language === 'auto',
            attempt: attempt
          });
          
          // Call the OpenAI API for transcription using the official SDK
          const transcription = await openai.audio.transcriptions.create(transcriptionParams);
          
          // Get the transcribed text from the result
          const transcribedText = transcription.text || "";
          
          if (!transcribedText || transcribedText.trim().length === 0) {
            throw new Error('Transcription returned empty result');
          }
          
          console.log(`[ChatTranscription] Success with model ${model} on attempt ${attempt}:`, {
            textLength: transcribedText.length,
            sampleText: transcribedText.substring(0, 100) + "...",
            model: model
          });
          
          // Return only transcribed text for chat
          return {
            text: transcribedText
          };
          
        } catch (error: any) {
          lastError = error;
          console.error(`[ChatTranscription] Attempt ${attempt}/3 failed with model ${model}:`, {
            error: error.message,
            status: error.status,
            type: error.type,
            code: error.code
          });
          
          // Check if this is a server error that might be temporary
          const isRetryableError = error.status >= 500 || 
                                  error.code === 'request_timeout' ||
                                  error.message?.includes('timeout') ||
                                  error.message?.includes('server error') ||
                                  error.message?.includes('internal error');
          
          if (!isRetryableError) {
            console.log(`[ChatTranscription] Non-retryable error with model ${model}, stopping retries`);
            break;
          }
          
          if (attempt < 3) {
            const waitTime = Math.pow(2, attempt - 1) * 2000; // 2s, 4s exponential backoff
            console.log(`[ChatTranscription] Retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
    }
    
    // If we get here, all attempts failed
    throw lastError || new Error('All transcription attempts failed');
    
  } catch (error) {
    console.error("[ChatTranscription] All transcription attempts failed:", error);
    throw error;
  }
}
