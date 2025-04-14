
/**
 * Utility functions for working with audio blobs
 */

/**
 * Converts a Blob to base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Ensure we have a valid result
      if (typeof reader.result === 'string' && reader.result.length > 0) {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert audio to base64'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading audio file'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Validates that an audio blob meets minimum requirements
 */
export function validateAudioBlob(audioBlob: Blob | null): { isValid: boolean; errorMessage?: string } {
  if (!audioBlob) {
    return { isValid: false, errorMessage: 'No recording to process.' };
  }
  
  // Minimum size check (lower minimum to 100 bytes to be more permissive)
  if (audioBlob.size < 100) {
    return { isValid: false, errorMessage: 'Recording is too short. Please try again.' };
  }
  
  // Check for supported MIME types
  const supportedTypes = [
    'audio/webm', 
    'audio/mp4', 
    'audio/ogg', 
    'audio/wav', 
    'audio/mpeg',
    'audio/webm;codecs=opus'
  ];
  
  // Use a fuzzy match to check for audio MIME type
  const isAudioType = audioBlob.type.includes('audio/') || 
                      supportedTypes.some(type => audioBlob.type.includes(type.split('/')[1]));
  
  if (!isAudioType) {
    console.warn('Potentially unsupported audio format:', audioBlob.type);
    // We'll continue anyway since browser implementations vary
  }
  
  return { isValid: true };
}

/**
 * Fixes common issues with audio blob MIME types
 */
export function normalizeAudioBlob(audioBlob: Blob): Blob {
  // If the blob is very small, add some padding to prevent "too short" errors
  if (audioBlob.size < 200) {
    console.log('Normalizing small audio blob with padding');
    const padding = new Uint8Array(1024).fill(0);
    return new Blob([audioBlob, padding], { type: audioBlob.type || 'audio/webm;codecs=opus' });
  }
  
  // If the blob doesn't have a proper MIME type, try to assign one
  if (!audioBlob.type.includes('audio/')) {
    // Look at the size to make an educated guess
    if (audioBlob.size > 1000000) {
      // Larger files are likely WAV
      return new Blob([audioBlob], { type: 'audio/wav' });
    } else {
      // Smaller files are likely Opus in WebM container
      return new Blob([audioBlob], { type: 'audio/webm;codecs=opus' });
    }
  }
  
  // If audio blob is webm but doesn't specify codec, add it
  if (audioBlob.type === 'audio/webm') {
    return new Blob([audioBlob], { type: 'audio/webm;codecs=opus' });
  }
  
  return audioBlob;
}
