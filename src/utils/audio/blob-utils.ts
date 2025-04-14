
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
 * Using extremely permissive validation to accept almost any recording
 */
export function validateAudioBlob(audioBlob: Blob | null): { isValid: boolean; errorMessage?: string } {
  if (!audioBlob) {
    return { isValid: false, errorMessage: 'No recording to process.' };
  }
  
  // Accept even very small blobs - we'll pad them later if needed
  if (audioBlob.size <= 0) {
    return { isValid: false, errorMessage: 'Empty recording detected.' };
  }
  
  console.log(`[blob-utils] Validated audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
  return { isValid: true };
}

/**
 * Fixes common issues with audio blob MIME types and adds padding to small files
 */
export function normalizeAudioBlob(audioBlob: Blob): Blob {
  console.log(`[blob-utils] Normalizing audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
  
  // If the blob is very small, add padding to prevent "too short" errors
  // Lower the threshold from 1000 to 200 bytes to be more permissive
  if (audioBlob.size < 200) {
    console.log('[blob-utils] Adding padding to small audio blob');
    // Create a larger padding for very small files (8KB instead of 4KB)
    const padding = new Uint8Array(8192).fill(0);
    return new Blob([audioBlob, padding], { type: getProperMimeType(audioBlob) });
  }
  
  // If the blob doesn't have a proper MIME type, assign one
  if (!audioBlob.type.includes('audio/')) {
    return new Blob([audioBlob], { type: getProperMimeType(audioBlob) });
  }
  
  return audioBlob;
}

/**
 * Determines the proper MIME type for an audio blob based on size and content
 */
function getProperMimeType(blob: Blob): string {
  // If the blob already has an audio MIME type, use it
  if (blob.type.includes('audio/')) {
    // If it's webm but doesn't specify codec, add it
    if (blob.type === 'audio/webm') {
      return 'audio/webm;codecs=opus';
    }
    return blob.type;
  }
  
  // Default for browsers with MediaRecorder
  if (typeof MediaRecorder !== 'undefined') {
    // Check if the browser supports opus in webm
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return 'audio/webm;codecs=opus';
    }
    
    // Fallbacks in order of preference
    const types = [
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
  }
  
  // Final fallback to webm/opus which is widely supported
  return 'audio/webm;codecs=opus';
}
