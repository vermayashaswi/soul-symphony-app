
/**
 * Utility functions for working with audio blobs
 */

/**
 * Converts a Blob to base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Error reading audio file'));
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
  
  return { isValid: true };
}
