
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
 * Gets the duration of an audio blob using the Audio API
 */
export function getAudioBlobDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    // First check if duration property is already set on the blob
    if ('duration' in blob && typeof (blob as any).duration === 'number') {
      resolve((blob as any).duration);
      return;
    }
    
    // Otherwise create an audio element to get the duration
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(blob);
    
    const onLoadedMetadata = () => {
      const duration = audio.duration;
      URL.revokeObjectURL(objectUrl);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
      resolve(isNaN(duration) || duration === Infinity ? 0 : duration);
    };
    
    const onError = () => {
      console.warn('Error getting audio duration from blob');
      URL.revokeObjectURL(objectUrl);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
      resolve(0);
    };
    
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('error', onError);
    
    // Set a timeout in case the metadata never loads
    const timeout = setTimeout(() => {
      console.warn('Timeout getting audio duration');
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
      URL.revokeObjectURL(objectUrl);
      
      // Try to estimate duration from blob size
      let estimatedDuration = 0;
      if (blob.size > 0) {
        // Rough estimation: ~128kbps
        estimatedDuration = blob.size / 16000;
      }
      
      resolve(estimatedDuration);
    }, 5000);
    
    audio.addEventListener('loadedmetadata', () => clearTimeout(timeout));
    audio.addEventListener('error', () => clearTimeout(timeout));
    
    // Start loading the audio
    audio.preload = 'metadata';
    audio.src = objectUrl;
  });
}

/**
 * Validates that an audio blob meets minimum requirements
 */
export function validateAudioBlob(audioBlob: Blob | null): { isValid: boolean; errorMessage?: string } {
  if (!audioBlob) {
    return { isValid: false, errorMessage: 'No recording to process.' };
  }
  
  // Minimum size check (increased to 1000 bytes for better validation)
  if (audioBlob.size < 1000) {
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
 * Safely adds a duration property to a blob
 * @returns A new blob with duration property, or the original if it already has duration
 */
export function safelyAddDurationProperty(blob: Blob, duration: number): Blob {
  // If the blob already has a duration property, return it as is
  if ('duration' in blob) {
    console.log('[safelyAddDurationProperty] Blob already has duration property:', (blob as any).duration);
    return blob;
  }
  
  // Create a new blob with the same content but same type
  const newBlob = new Blob([blob], { type: blob.type });
  
  try {
    // Attempt to define the duration property
    Object.defineProperty(newBlob, 'duration', {
      value: duration,
      writable: false,
      enumerable: true
    });
    console.log(`[safelyAddDurationProperty] Added duration ${duration}s to blob`);
  } catch (error) {
    console.warn('[safelyAddDurationProperty] Could not add duration to blob:', error);
  }
  
  return newBlob;
}

/**
 * Fixes common issues with audio blob MIME types and adds duration if missing
 * @returns Promise<Blob> A promise that resolves to the normalized audio blob
 */
export function normalizeAudioBlob(audioBlob: Blob): Promise<Blob> {
  return new Promise(async (resolve) => {
    try {
      let resultBlob = audioBlob;
      let duration = 0;
      
      // If blob doesn't have duration property, try to get it
      if (!('duration' in audioBlob)) {
        duration = await getAudioBlobDuration(audioBlob);
        if (duration > 0) {
          resultBlob = safelyAddDurationProperty(resultBlob, duration);
        }
      } else {
        duration = (audioBlob as any).duration;
        console.log(`[normalizeAudioBlob] Blob already has duration ${duration}s`);
      }
      
      // If the blob doesn't have a proper MIME type, try to assign one
      if (!resultBlob.type.includes('audio/')) {
        // Look at the size to make an educated guess
        const newBlobType = resultBlob.size > 1000000 ? 'audio/wav' : 'audio/webm;codecs=opus';
        const newBlob = new Blob([resultBlob], { type: newBlobType });
        
        // Transfer the duration if it exists
        if (duration > 0) {
          resultBlob = safelyAddDurationProperty(newBlob, duration);
        } else {
          resultBlob = newBlob;
        }
      } 
      // If audio blob is webm but doesn't specify codec, add it
      else if (resultBlob.type === 'audio/webm') {
        const newBlob = new Blob([resultBlob], { type: 'audio/webm;codecs=opus' });
        
        // Transfer the duration if it exists
        if (duration > 0) {
          resultBlob = safelyAddDurationProperty(newBlob, duration);
        } else {
          resultBlob = newBlob;
        }
      }
      
      // Return the fully normalized blob
      resolve(resultBlob);
    } catch (error) {
      console.error('[normalizeAudioBlob] Error:', error);
      // Return the original blob in case of error
      resolve(audioBlob);
    }
  });
}
