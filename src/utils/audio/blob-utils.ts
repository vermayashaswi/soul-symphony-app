
/**
 * Utility functions for blob operations
 */

/**
 * Converts a Blob to a base64 string
 * @param blob - The blob to convert
 * @returns Promise resolving to a base64 string
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // reader.result will be a data URL like "data:audio/webm;base64,SGVsbG8gd29ybGQ="
      // We want to return the full string with the data URL prefix
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Validates an audio blob to ensure it's usable for processing
 * @param blob - The audio blob to validate
 * @returns Validation result with status and error message if any
 */
export const validateAudioBlob = (blob: Blob | null): {
  isValid: boolean;
  errorMessage?: string;
} => {
  if (!blob) {
    return {
      isValid: false,
      errorMessage: 'No audio data available'
    };
  }

  if (blob.size === 0) {
    return {
      isValid: false,
      errorMessage: 'Audio recording is empty'
    };
  }

  // Check if the blob has a valid MIME type
  const validAudioTypes = [
    'audio/webm',
    'audio/mp4',
    'audio/wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/ogg'
  ];

  if (!blob.type || !validAudioTypes.includes(blob.type)) {
    console.warn(`[BlobUtils] Audio has an unrecognized type: ${blob.type || 'unknown'}`);
    // We'll still accept it, but log a warning
  }

  // If the blob has a duration property, ensure it's reasonable
  if ('duration' in blob) {
    const duration = (blob as any).duration;
    if (typeof duration === 'number' && duration < 0.5) {
      return {
        isValid: false,
        errorMessage: 'Recording is too short (less than 0.5 seconds)'
      };
    }
  }

  return { isValid: true };
};

/**
 * Normalizes an audio blob to ensure it has the correct type and format
 * @param blob - The original audio blob
 * @returns Promise resolving to a normalized blob
 */
export const normalizeAudioBlob = async (
  blob: Blob
): Promise<Blob> => {
  try {
    // Check if the blob is already a valid audio type
    const validAudioTypes = [
      'audio/webm', 
      'audio/mp4', 
      'audio/wav', 
      'audio/mpeg', 
      'audio/mp3',
      'audio/ogg'
    ];
    
    let mimeType = blob.type;
    
    // If no valid mime type, try to determine from the first bytes
    if (!validAudioTypes.includes(mimeType)) {
      console.log(`[BlobUtils] Invalid MIME type: ${mimeType}, trying to determine from content`);
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer.slice(0, 16));
      
      // Detection based on header bytes
      if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
        mimeType = 'audio/webm';
      } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        mimeType = 'audio/wav';
      } else if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
        mimeType = 'audio/mp3';
      } else if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
        mimeType = 'audio/mp4';
      } else {
        console.log('[BlobUtils] Could not determine audio type, defaulting to audio/webm');
        mimeType = 'audio/webm';
      }
    }
    
    // Create a new blob with the correct MIME type
    const normalizedBlob = new Blob([await blob.arrayBuffer()], { type: mimeType });
    
    // Add the duration property if it exists on the original blob
    if ('duration' in blob) {
      Object.defineProperty(normalizedBlob, 'duration', {
        value: (blob as any).duration,
        writable: false
      });
    }
    
    console.log(`[BlobUtils] Normalized blob: size=${normalizedBlob.size}, type=${normalizedBlob.type}, hasDuration=${'duration' in normalizedBlob}`);
    return normalizedBlob;
  } catch (error) {
    console.error('[BlobUtils] Error normalizing audio blob:', error);
    return blob; // Return original blob on error
  }
};
