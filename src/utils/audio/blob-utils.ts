
/**
 * Utility functions for working with audio blobs
 */

/**
 * Converts a Blob to base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!blob || blob.size === 0) {
      reject(new Error('Invalid blob: empty or null'));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader did not return a string'));
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
  
  if (audioBlob.size < 1000) { // 1KB minimum
    return { isValid: false, errorMessage: 'Recording is too short. Please try again.' };
  }
  
  // Validate MIME type
  const validTypes = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg'];
  const isValidType = validTypes.some(type => audioBlob.type.includes(type)) || audioBlob.type === '';
  
  if (!isValidType) {
    console.warn('Unusual audio MIME type:', audioBlob.type);
    // Not blocking based on MIME type for now, but logging it
  }
  
  return { isValid: true };
}
