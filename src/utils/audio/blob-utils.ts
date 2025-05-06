
/**
 * Utilities for working with audio Blobs
 */

// Convert blob to base64 string
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => {
        console.error('Error converting blob to base64:', error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error in blobToBase64:', error);
      reject(error);
    }
  });
}

// Basic validation for audio blobs
export function validateAudioBlob(blob: Blob): { isValid: boolean; errorMessage?: string } {
  if (!blob) {
    return { isValid: false, errorMessage: 'No audio data provided' };
  }

  if (blob.size === 0) {
    return { isValid: false, errorMessage: 'Audio data is empty' };
  }

  if (!blob.type.startsWith('audio/')) {
    console.warn(`[validateAudioBlob] Unusual blob type: ${blob.type}. Will try to process anyway.`);
  }

  return { isValid: true };
}

// Normalize audio blob with improved error handling
export async function normalizeAudioBlob(blob: Blob): Promise<Blob> {
  // First validate the blob
  const validation = validateAudioBlob(blob);
  if (!validation.isValid) {
    throw new Error(validation.errorMessage || 'Invalid audio blob');
  }
  
  try {
    // Create safe copies of relevant properties
    let blobDuration: number | undefined;
    if ('duration' in blob) {
      blobDuration = (blob as any).duration;
    }
    
    // For small blobs or when normalization is not needed, just enhance the blob
    if (blob.size < 10000) {
      // For small blobs, just add metadata if missing
      const enhancedBlob = new Blob([blob], { type: blob.type || 'audio/webm;codecs=opus' });
      
      // Add duration if it exists in the original
      if (blobDuration !== undefined) {
        try {
          Object.defineProperty(enhancedBlob, 'duration', {
            value: blobDuration,
            writable: false
          });
        } catch (err) {
          console.warn("[normalizeAudioBlob] Could not copy duration to blob:", err);
        }
      }
      
      return enhancedBlob;
    }
    
    // For larger blobs, proper normalization would go here
    // But for now, we'll just return the blob with metadata
    
    // Create a new blob with the same content but potentially fixed type
    const normalizedBlob = new Blob([blob], { 
      type: blob.type || 'audio/webm;codecs=opus' 
    });
    
    // Copy duration if it exists
    if (blobDuration !== undefined) {
      try {
        Object.defineProperty(normalizedBlob, 'duration', {
          value: blobDuration,
          writable: false
        });
      } catch (err) {
        console.warn("[normalizeAudioBlob] Could not copy duration to blob:", err);
      }
    }
    
    return normalizedBlob;
  } catch (error) {
    console.error('[normalizeAudioBlob] Error normalizing blob:', error);
    // If normalization fails, return the original blob
    return blob;
  }
}

// Generate a unique ID for blobs
export function generateBlobId(): string {
  return `blob-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

// Safe revocation of blob URLs with error handling
export function safeRevokeObjectURL(url: string | null): void {
  if (!url) return;
  
  try {
    URL.revokeObjectURL(url);
  } catch (error) {
    console.warn('[safeRevokeObjectURL] Error revoking URL:', error);
  }
}
