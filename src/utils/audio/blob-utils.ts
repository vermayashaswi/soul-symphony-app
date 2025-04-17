
/**
 * Converts a Blob to a Base64 string
 * @param blob The audio blob to convert
 * @returns A Promise that resolves to a Base64 string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        // FileReader result is a string or ArrayBuffer
        const base64String = reader.result as string;
        
        // If the result contains a data URL prefix, extract just the Base64 part
        const base64Data = base64String.indexOf('base64,') !== -1 
          ? base64String.split('base64,')[1]
          : base64String;
          
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Validates an audio blob to ensure it's usable
 * @param blob The audio blob to validate
 * @returns An object with validation results
 */
export function validateAudioBlob(blob: Blob | null): { 
  isValid: boolean; 
  errorMessage?: string 
} {
  // Basic validation
  if (!blob) {
    return { isValid: false, errorMessage: "No audio data provided" };
  }
  
  if (blob.size === 0) {
    return { isValid: false, errorMessage: "Audio file is empty" };
  }
  
  if (blob.size > 25 * 1024 * 1024) {
    return { isValid: false, errorMessage: "Audio file is too large (> 25MB)" };
  }
  
  // Check for valid audio mime type
  const validAudioTypes = [
    'audio/webm', 'audio/mp4', 'audio/mp3', 'audio/mpeg', 
    'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/ogg',
    'video/webm', 'video/mp4' // Some recorders use video containers
  ];
  
  if (!validAudioTypes.includes(blob.type)) {
    console.warn(`[Validation] Unusual audio MIME type: ${blob.type}`);
    // Continue anyway, as some browsers return non-standard types
  }
  
  return { isValid: true };
}

/**
 * Normalizes audio blob by ensuring it has the right format and properties
 * @param blob Original audio blob 
 * @returns Normalized blob with corrected metadata
 */
export async function normalizeAudioBlob(blob: Blob): Promise<Blob> {
  // If blob already has valid properties, just return it
  if (blob.type === 'audio/wav' || blob.type === 'audio/webm') {
    console.log('[BlobUtils] Audio blob already in supported format:', blob.type);
    return blob;
  }
  
  // If blob type is not specified or not recognized, try to infer it
  let detectedType = blob.type || 'audio/webm';
  
  // Convert blob to ArrayBuffer to check header bytes
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const header = new Uint8Array(arrayBuffer.slice(0, 4));
    
    // Check WebM signature (0x1A 0x45 0xDF 0xA3)
    if (header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3) {
      detectedType = 'audio/webm';
    }
    // Check WAV signature (RIFF header)
    else if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
      detectedType = 'audio/wav';
    }
  } catch (error) {
    console.warn('[BlobUtils] Failed to detect file type from header bytes:', error);
  }
  
  // Create a new blob with the correct type
  console.log('[BlobUtils] Normalizing audio blob to type:', detectedType);
  const normalizedBlob = new Blob([await blob.arrayBuffer()], { type: detectedType });
  
  // Copy over duration property if present
  if ('duration' in blob) {
    Object.defineProperty(normalizedBlob, 'duration', {
      value: (blob as any).duration,
      writable: false
    });
  }
  
  return normalizedBlob;
}
