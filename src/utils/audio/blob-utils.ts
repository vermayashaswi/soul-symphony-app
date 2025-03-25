
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

    console.log("Converting blob to base64, size:", blob.size, "type:", blob.type);
    const reader = new FileReader();
    
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        console.log("Base64 conversion successful, length:", reader.result.length);
        resolve(reader.result);
      } else {
        console.error("FileReader did not return a string, result type:", typeof reader.result);
        reject(new Error('FileReader did not return a string'));
      }
    };
    
    reader.onerror = (e) => {
      console.error("FileReader error:", e);
      reject(new Error('Error reading audio file'));
    };
    
    reader.readAsDataURL(blob);
  });
}

/**
 * Validates that an audio blob meets minimum requirements
 */
export function validateAudioBlob(audioBlob: Blob | null): { isValid: boolean; errorMessage?: string } {
  if (!audioBlob) {
    console.error("Audio blob is null or undefined");
    return { isValid: false, errorMessage: 'No recording to process.' };
  }
  
  console.log("Validating audio blob, size:", audioBlob.size, "type:", audioBlob.type);
  
  if (audioBlob.size < 1000) { // 1KB minimum
    console.error("Audio blob is too small:", audioBlob.size);
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
