/**
 * Converts a Blob to a Base64 string WITH data URL prefix
 * @param blob The audio blob to convert
 * @returns A Promise that resolves to a complete data URL string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Enhanced blob validation before processing
      if (!blob) {
        reject(new Error('No blob provided for conversion'));
        return;
      }

      if (blob.size === 0) {
        reject(new Error('Blob is empty (0 bytes)'));
        return;
      }

      if (blob.size > 50 * 1024 * 1024) { // 50MB limit
        reject(new Error(`Blob too large: ${blob.size} bytes (max: 50MB)`));
        return;
      }

      console.log('[BlobUtils] Starting base64 conversion:', {
        blobSize: blob.size,
        blobType: blob.type,
        hasArrayBuffer: typeof blob.arrayBuffer === 'function',
        hasStream: typeof blob.stream === 'function'
      });

      const reader = new FileReader();
      
      reader.onloadend = () => {
        try {
          const result = reader.result;
          
          if (!result) {
            reject(new Error('FileReader returned null result'));
            return;
          }

          if (typeof result !== 'string') {
            reject(new Error('FileReader result is not a string'));
            return;
          }

          // Validate the data URL format
          if (!result.startsWith('data:')) {
            reject(new Error('Invalid data URL format - missing data: prefix'));
            return;
          }

          if (!result.includes('base64,')) {
            reject(new Error('Invalid data URL format - missing base64 marker'));
            return;
          }

          // Extract and validate base64 content
          const base64Part = result.split('base64,')[1];
          if (!base64Part || base64Part.length < 10) {
            reject(new Error('Base64 content is too short or empty'));
            return;
          }

          // Validate base64 format
          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Part)) {
            reject(new Error('Invalid base64 format detected'));
            return;
          }

          console.log('[BlobUtils] Base64 conversion successful:', {
            originalSize: blob.size,
            dataUrlLength: result.length,
            base64Length: base64Part.length,
            compressionRatio: (result.length / blob.size).toFixed(2),
            mimeType: result.split(';')[0]
          });

          resolve(result);
        } catch (error) {
          console.error('[BlobUtils] Error processing FileReader result:', error);
          reject(new Error(`Failed to process conversion result: ${error.message}`));
        }
      };

      reader.onerror = (error) => {
        console.error('[BlobUtils] FileReader error:', error);
        reject(new Error(`FileReader failed: ${error.toString()}`));
      };

      reader.onabort = () => {
        console.error('[BlobUtils] FileReader aborted');
        reject(new Error('FileReader operation was aborted'));
      };

      // Start the conversion
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('[BlobUtils] Error setting up FileReader:', error);
      reject(new Error(`Failed to set up file reader: ${error.message}`));
    }
  });
}

/**
 * Extracts just the base64 data from a data URL
 * @param dataUrl Complete data URL string
 * @returns Just the base64 portion
 */
export function extractBase64FromDataUrl(dataUrl: string): string {
  if (!dataUrl.includes('base64,')) {
    throw new Error('Invalid data URL format - missing base64 prefix');
  }
  return dataUrl.split('base64,')[1];
}

/**
 * Validates an audio blob to ensure it's usable
 * @param blob The audio blob to validate
 * @returns An object with validation results
 */
export function validateAudioBlob(blob: Blob | null): { 
  isValid: boolean; 
  errorMessage?: string;
  details?: any;
} {
  try {
    // Basic null check
    if (!blob) {
      return { 
        isValid: false, 
        errorMessage: "No audio data provided",
        details: { reason: 'null_blob' }
      };
    }
    
    // Size validation
    if (blob.size === 0) {
      return { 
        isValid: false, 
        errorMessage: "Audio file is empty (0 bytes)",
        details: { reason: 'empty_blob', size: blob.size }
      };
    }
    
    if (blob.size < 100) {
      return { 
        isValid: false, 
        errorMessage: "Audio file is too small (likely corrupted)",
        details: { reason: 'too_small', size: blob.size }
      };
    }
    
    if (blob.size > 25 * 1024 * 1024) {
      return { 
        isValid: false, 
        errorMessage: "Audio file is too large (> 25MB)",
        details: { reason: 'too_large', size: blob.size }
      };
    }
    
    // Type validation
    const validAudioTypes = [
      'audio/webm', 'audio/mp4', 'audio/mp3', 'audio/mpeg', 
      'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/ogg',
      'video/webm', 'video/mp4', 'application/octet-stream'
    ];
    
    if (blob.type && !validAudioTypes.includes(blob.type)) {
      console.warn(`[Validation] Unusual MIME type: ${blob.type}, allowing anyway`);
    }

    // Check if blob has the necessary methods
    if (typeof blob.arrayBuffer !== 'function') {
      return {
        isValid: false,
        errorMessage: "Blob missing arrayBuffer method",
        details: { reason: 'missing_methods', availableMethods: Object.getOwnPropertyNames(blob) }
      };
    }

    console.log('[Validation] Audio blob validation passed:', {
      size: blob.size,
      type: blob.type || 'unknown',
      hasArrayBuffer: typeof blob.arrayBuffer === 'function',
      hasStream: typeof blob.stream === 'function',
      constructor: blob.constructor.name
    });
    
    return { 
      isValid: true,
      details: {
        size: blob.size,
        type: blob.type,
        constructor: blob.constructor.name
      }
    };
  } catch (error) {
    console.error('[Validation] Error during blob validation:', error);
    return {
      isValid: false,
      errorMessage: `Validation error: ${error.message}`,
      details: { reason: 'validation_exception', error: error.message }
    };
  }
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
  
  let detectedType = blob.type || 'audio/webm';
  
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const header = new Uint8Array(arrayBuffer.slice(0, 4));
    
    if (header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3) {
      detectedType = 'audio/webm';
    }
    else if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
      detectedType = 'audio/wav';
    }
  } catch (error) {
    console.warn('[BlobUtils] Failed to detect file type from header bytes:', error);
  }
  
  console.log('[BlobUtils] Normalizing audio blob to type:', detectedType);
  const normalizedBlob = new Blob([await blob.arrayBuffer()], { type: detectedType });
  
  if ('duration' in blob) {
    Object.defineProperty(normalizedBlob, 'duration', {
      value: (blob as any).duration,
      writable: false
    });
  }
  
  return normalizedBlob;
}

/**
 * Calculate the byte length of a string when encoded as UTF-8
 * @param str The string to measure
 * @returns The byte length
 */
export function getUtf8ByteLength(str: string): number {
  if (!str || typeof str !== 'string') {
    return 0;
  }
  
  try {
    // Use TextEncoder for accurate UTF-8 byte length calculation
    const encoder = new TextEncoder();
    return encoder.encode(str).length;
  } catch (error) {
    console.error('[ByteLength] Error calculating UTF-8 byte length:', error);
    // Fallback method
    return unescape(encodeURIComponent(str)).length;
  }
}

/**
 * Create a test blob to verify functionality
 */
export function createTestBlob(): Blob {
  const testData = new Uint8Array(1024).fill(65); // 1KB of 'A' characters
  return new Blob([testData], { type: 'audio/webm' });
}

/**
 * Test the complete blob processing pipeline
 */
export async function testBlobProcessing(blob: Blob): Promise<{
  success: boolean;
  stages: any;
  error?: string;
}> {
  const stages = {
    validation: null,
    conversion: null,
    payloadTest: null
  };

  try {
    // Stage 1: Validation
    console.log('[Test] Stage 1: Validating blob...');
    stages.validation = validateAudioBlob(blob);
    if (!stages.validation.isValid) {
      throw new Error(`Validation failed: ${stages.validation.errorMessage}`);
    }

    // Stage 2: Base64 conversion
    console.log('[Test] Stage 2: Converting to base64...');
    const startTime = Date.now();
    const dataUrl = await blobToBase64(blob);
    const conversionTime = Date.now() - startTime;
    
    stages.conversion = {
      success: true,
      dataUrlLength: dataUrl.length,
      conversionTime,
      hasPrefix: dataUrl.startsWith('data:'),
      hasBase64Marker: dataUrl.includes('base64,')
    };

    // Stage 3: Payload validation
    console.log('[Test] Stage 3: Testing payload creation...');
    const testPayload = {
      audio: dataUrl,
      userId: 'test-user-id',
      recordingTime: 5000,
      highQuality: true
    };
    
    stages.payloadTest = validatePayloadSize(testPayload);
    
    console.log('[Test] All stages completed successfully');
    return {
      success: true,
      stages
    };
  } catch (error) {
    console.error('[Test] Pipeline test failed:', error);
    return {
      success: false,
      stages,
      error: error.message
    };
  }
}

/**
 * Validate payload size before sending to edge function
 * @param payload The payload object to validate
 * @returns Validation result with size information
 */
export function validatePayloadSize(payload: any): {
  isValid: boolean;
  sizeBytes: number;
  sizeMB: number;
  errorMessage?: string;
  breakdown?: any;
} {
  try {
    const payloadString = JSON.stringify(payload);
    const sizeBytes = getUtf8ByteLength(payloadString);
    const sizeMB = sizeBytes / (1024 * 1024);
    
    // Calculate component sizes
    const breakdown = {
      total: sizeBytes,
      audio: payload.audio ? getUtf8ByteLength(payload.audio) : 0,
      userId: payload.userId ? getUtf8ByteLength(payload.userId) : 0,
      metadata: sizeBytes - (payload.audio ? getUtf8ByteLength(payload.audio) : 0),
      audioDataLength: payload.audio ? payload.audio.length : 0
    };
    
    console.log('[PayloadValidation] Detailed size breakdown:', {
      totalBytes: sizeBytes,
      totalMB: sizeMB.toFixed(2),
      audioBytes: breakdown.audio,
      audioMB: (breakdown.audio / (1024 * 1024)).toFixed(2),
      metadataBytes: breakdown.metadata,
      audioStringLength: breakdown.audioDataLength,
      estimatedCompressionRatio: breakdown.audioDataLength > 0 ? (breakdown.audio / breakdown.audioDataLength).toFixed(2) : 'N/A'
    });
    
    // Check against size limits with buffer
    const maxSizeBytes = 24 * 1024 * 1024; // 24MB to leave buffer for 25MB limit
    
    if (sizeBytes > maxSizeBytes) {
      return {
        isValid: false,
        sizeBytes,
        sizeMB,
        breakdown,
        errorMessage: `Payload too large: ${sizeMB.toFixed(2)}MB (max: 24MB)`
      };
    }

    // Additional validation for audio component
    if (breakdown.audio > 23 * 1024 * 1024) { // Audio alone shouldn't exceed 23MB
      return {
        isValid: false,
        sizeBytes,
        sizeMB,
        breakdown,
        errorMessage: `Audio data too large: ${(breakdown.audio / (1024 * 1024)).toFixed(2)}MB (max: 23MB)`
      };
    }
    
    return {
      isValid: true,
      sizeBytes,
      sizeMB,
      breakdown
    };
  } catch (error) {
    console.error('[PayloadValidation] Error validating payload size:', error);
    return {
      isValid: false,
      sizeBytes: 0,
      sizeMB: 0,
      errorMessage: `Error validating payload: ${error.message}`
    };
  }
}
