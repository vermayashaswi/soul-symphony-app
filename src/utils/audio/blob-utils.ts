/**
 * Utility functions for working with audio blobs
 */

/**
 * Converts a Blob to base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  console.log('[blob-utils] Converting blob to base64, size:', blob.size, 'type:', blob.type);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Ensure we have a valid result
      if (typeof reader.result === 'string' && reader.result.length > 0) {
        console.log('[blob-utils] Successfully converted to base64, length:', reader.result.length);
        resolve(reader.result);
      } else {
        console.error('[blob-utils] Failed to convert to base64, invalid result');
        reject(new Error('Failed to convert audio to base64'));
      }
    };
    reader.onerror = () => {
      console.error('[blob-utils] Error reading audio file in FileReader');
      reject(new Error('Error reading audio file'));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Validates that an audio blob meets minimum requirements
 * Using extremely permissive validation to accept almost any recording
 */
export function validateAudioBlob(audioBlob: Blob | null): { isValid: boolean; errorMessage?: string } {
  console.log('[blob-utils] Validating audio blob:', audioBlob);
  
  if (!audioBlob) {
    console.error('[blob-utils] No recording to process.');
    return { isValid: false, errorMessage: 'No recording to process.' };
  }
  
  // Accept even very small blobs - we'll pad them later if needed
  if (audioBlob.size <= 0) {
    console.error('[blob-utils] Empty recording detected.');
    return { isValid: false, errorMessage: 'Empty recording detected.' };
  }
  
  // Check for duration property
  const blobDuration = (audioBlob as any).duration;
  if (blobDuration === undefined || blobDuration === null) {
    console.warn('[blob-utils] Audio blob has no duration property - will be fixed in normalization');
  } else if (blobDuration < 0.1) {
    console.warn('[blob-utils] Audio blob has very short duration:', blobDuration, '- will be fixed in normalization');
  } else {
    console.log(`[blob-utils] Audio blob has valid duration: ${blobDuration}s`);
  }
  
  console.log(`[blob-utils] Validated audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
  return { isValid: true };
}

/**
 * Fixes common issues with audio blob MIME types and adds padding to small files
 * Also ensures duration is properly set
 */
export function normalizeAudioBlob(audioBlob: Blob): Blob {
  console.log(`[blob-utils] Normalizing audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
  
  // Extract the original duration if present
  const originalDuration = (audioBlob as any).duration;
  console.log(`[blob-utils] Original blob duration: ${originalDuration || 'undefined'}`);
  
  // If no duration is set or it's too small, try to estimate a reasonable one
  let effectiveDuration = originalDuration;
  if (effectiveDuration === undefined || effectiveDuration === null || effectiveDuration < 0.5) {
    // Estimate based on audio size (rough approximation)
    // For WAV files, approximately 172KB per second for 44.1kHz, 16-bit stereo
    // For compressed formats, use a different estimation
    let estimatedDuration: number;
    
    if (audioBlob.type.includes('wav')) {
      estimatedDuration = Math.max(0.5, audioBlob.size / 172000);
    } else if (audioBlob.type.includes('webm') || audioBlob.type.includes('ogg')) {
      // WebM/Opus and Ogg have much better compression - roughly 16KB per second
      estimatedDuration = Math.max(0.5, audioBlob.size / 16000);
    } else {
      // For MP3 and other formats - roughly 32KB per second at 128kbps
      estimatedDuration = Math.max(0.5, audioBlob.size / 32000);
    }
    
    console.log(`[blob-utils] Estimated duration from size: ${estimatedDuration.toFixed(2)}s`);
    effectiveDuration = estimatedDuration;
  }
  
  // If the blob is very small, add significant padding
  let resultBlob: Blob;
  
  if (audioBlob.size < 5000) {
    console.log('[blob-utils] Adding padding to small audio blob');
    // Create a larger padding for very small files (256KB)
    const padding = new Uint8Array(262144).fill(0);
    resultBlob = new Blob([audioBlob, padding], { type: getProperMimeType(audioBlob) });
    console.log('[blob-utils] After padding:', resultBlob.size, 'bytes, type:', resultBlob.type);
  } else if (!audioBlob.type.includes('audio/')) {
    // If the blob doesn't have a proper MIME type, assign one
    resultBlob = new Blob([audioBlob], { type: getProperMimeType(audioBlob) });
    console.log('[blob-utils] Fixed MIME type:', resultBlob.type);
  } else {
    resultBlob = new Blob([audioBlob], { type: audioBlob.type });
  }
  
  // ALWAYS ensure duration is explicitly set on the result blob
  // Create a new blob to ensure the duration property sticks
  const finalBlob = new Blob([resultBlob], { type: resultBlob.type });
  
  // Try multiple approaches to set the duration property
  
  // Method 1: defineProperty
  Object.defineProperty(finalBlob, 'duration', {
    value: effectiveDuration,
    writable: false,
    configurable: true,
    enumerable: true
  });
  
  // Method 2: Direct assignment (as backup)
  (finalBlob as any).duration = effectiveDuration;
  
  // Method 3: Add additional properties that might be checked
  (finalBlob as any)._duration = effectiveDuration;
  (finalBlob as any).recordingDuration = effectiveDuration;
  
  // Verify the duration was set
  const finalDuration = (finalBlob as any).duration;
  console.log(`[blob-utils] Final normalized blob: ${finalBlob.size} bytes, type: ${finalBlob.type}, duration: ${finalDuration}s`);
  
  if (finalDuration === undefined || finalDuration < 0.1) {
    console.warn('[blob-utils] Warning: Duration still not properly set on normalized blob!');
  }
  
  return finalBlob;
}

/**
 * Determines the proper MIME type for an audio blob based on size and content
 */
export function getProperMimeType(blob: Blob): string {
  // WAV is much more reliable for duration detection
  if (MediaRecorder.isTypeSupported('audio/wav')) {
    console.log('[blob-utils] Using WAV format for better duration support');
    return 'audio/wav';
  }
  
  // If the blob already has an audio MIME type, use it
  if (blob.type.includes('audio/')) {
    // If it's webm but doesn't specify codec, add it
    if (blob.type === 'audio/webm') {
      console.log('[blob-utils] Setting specific codec for webm:', 'audio/webm;codecs=opus');
      return 'audio/webm;codecs=opus';
    }
    return blob.type;
  }
  
  console.log('[blob-utils] Checking browser MIME type support');
  
  // Check for browser support
  if (typeof MediaRecorder !== 'undefined') {
    // First try WAV as it has better duration support
    if (MediaRecorder.isTypeSupported('audio/wav')) {
      console.log('[blob-utils] Using WAV format for better duration support');
      return 'audio/wav';
    }
    
    // Then try other formats
    const types = [
      'audio/webm;codecs=opus',
      'audio/mpeg',
      'audio/mp3',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('[blob-utils] Found supported MIME type:', type);
        return type;
      }
    }
  }
  
  // Final fallback to wav which has better metadata support
  console.log('[blob-utils] Using fallback MIME type: audio/wav');
  return 'audio/wav';
}

/**
 * Extract audio file data from a Blob
 */
export function extractAudioData(blob: Blob): Promise<ArrayBuffer> {
  console.log('[blob-utils] Extracting audio data from blob, size:', blob.size);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result instanceof ArrayBuffer) {
        console.log('[blob-utils] Successfully extracted ArrayBuffer, size:', reader.result.byteLength);
        resolve(reader.result);
      } else {
        console.error('[blob-utils] Failed to read as ArrayBuffer');
        reject(new Error('Failed to read audio data as ArrayBuffer'));
      }
    };
    reader.onerror = () => {
      console.error('[blob-utils] Error reading audio file with FileReader');
      reject(new Error('Error reading audio file'));
    };
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Creates a playable audio blob from various formats
 * This helps with browser compatibility issues
 */
export function createPlayableAudioBlob(originalBlob: Blob): Blob {
  console.log('[blob-utils] Creating playable blob from:', originalBlob.size, 'bytes, type:', originalBlob.type);
  
  // Preserve original duration
  const originalDuration = (originalBlob as any).duration;
  console.log(`[blob-utils] Original blob duration for playable: ${originalDuration || 'undefined'}`);
  
  // For very small blobs, add significant padding
  if (originalBlob.size < 2000) {
    console.log('[blob-utils] Creating significantly padded playable blob');
    // Add 256KB of padding for very small files
    const padding = new Uint8Array(262144).fill(0);
    
    // Try several formats for better browser compatibility
    let paddedBlob: Blob;
    
    if (MediaRecorder.isTypeSupported('audio/mp3')) {
      paddedBlob = new Blob([originalBlob, padding], { type: 'audio/mp3' });
      console.log('[blob-utils] Created MP3 padded blob:', paddedBlob.size, 'bytes');
    } else if (MediaRecorder.isTypeSupported('audio/wav')) {
      paddedBlob = new Blob([originalBlob, padding], { type: 'audio/wav' });
      console.log('[blob-utils] Created WAV padded blob:', paddedBlob.size, 'bytes');
    } else {
      paddedBlob = new Blob([originalBlob, padding], { 
        type: 'audio/webm;codecs=opus' 
      });
      console.log('[blob-utils] Created WebM padded blob:', paddedBlob.size, 'bytes');
    }
    
    // Transfer duration to the new blob if it exists
    if (originalDuration && originalDuration > 0) {
      Object.defineProperty(paddedBlob, 'duration', {
        value: originalDuration,
        writable: false,
        configurable: true
      });
      console.log(`[blob-utils] Transferred duration ${originalDuration}s to padded playable blob`);
    }
    
    return paddedBlob;
  }
  
  // If the original blob is already a playable format, return it
  const playableTypes = [
    'audio/wav',
    'audio/mp3',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac'
  ];
  
  // For certain modern browsers, webm is also playable
  if (originalBlob.type.includes('webm') && 
      typeof MediaSource !== 'undefined' && 
      MediaSource.isTypeSupported('audio/webm;codecs=opus')) {
    console.log('[blob-utils] Original WebM blob is playable in this browser');
    return originalBlob;
  }
  
  // If it's a known playable type, use it
  if (playableTypes.some(type => originalBlob.type.includes(type))) {
    console.log('[blob-utils] Original blob has playable type:', originalBlob.type);
    return originalBlob;
  }
  
  // For other formats, try converting to MP3 as it's widely supported
  const convertedBlob = new Blob([originalBlob], { 
    type: 'audio/mpeg' 
  });
  console.log('[blob-utils] Created MP3 blob:', convertedBlob.size, 'bytes');
  
  // Transfer duration to the converted blob if it exists
  if (originalDuration && originalDuration > 0) {
    Object.defineProperty(convertedBlob, 'duration', {
      value: originalDuration,
      writable: false,
      configurable: true
    });
    console.log(`[blob-utils] Transferred duration ${originalDuration}s to converted playable blob`);
  }
  
  return convertedBlob;
}
