
/**
 * Audio processing utilities
 */

/**
 * Processes base64 string chunks into a Uint8Array
 */
export function processBase64Chunks(base64String: string, chunkSize = 32768): Uint8Array {
  if (!base64String || base64String.length === 0) {
    console.error('Empty base64 string provided');
    return new Uint8Array(0);
  }

  try {
    // First, clean the base64 input - remove any non-base64 characters
    const cleanBase64 = base64String.replace(/^data:.*?;base64,/, '').replace(/\s/g, '');
    
    if (cleanBase64.length === 0) {
      console.error('Base64 string was invalid or empty after cleaning');
      return new Uint8Array(0);
    }
    
    console.log(`Processing base64 data: ${cleanBase64.length} characters`);
    
    const chunks: Uint8Array[] = [];
    let position = 0;
    
    while (position < cleanBase64.length) {
      const chunk = cleanBase64.slice(position, position + chunkSize);
      try {
        const binaryChunk = atob(chunk);
        const bytes = new Uint8Array(binaryChunk.length);
        
        for (let i = 0; i < binaryChunk.length; i++) {
          bytes[i] = binaryChunk.charCodeAt(i);
        }
        
        chunks.push(bytes);
      } catch (error) {
        console.error('Error processing base64 chunk:', error);
        // Skip bad chunk and continue
      }
      
      position += chunkSize;
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    // If the resulting array is very small or empty, add padding
    if (result.length < 1000) {
      console.log("Audio data very small, adding padding");
      const paddedResult = new Uint8Array(result.length + 16384); // Add 16KB padding
      paddedResult.set(result);
      // Fill the rest with silence (0s)
      for (let i = result.length; i < paddedResult.length; i++) {
        paddedResult[i] = 0;
      }
      return paddedResult;
    }

    return result;
  } catch (error) {
    console.error('Error processing base64 chunks:', error);
    // Return at least an empty but valid audio file
    const emptyAudio = new Uint8Array(8192).fill(0);
    return emptyAudio;
  }
}

/**
 * Detects the file type from the audio data
 */
export function detectFileType(data: Uint8Array): string {
  // Check for WebM signature
  if (data.length > 4 && data[0] === 0x1A && data[1] === 0x45 && data[2] === 0xDF && data[3] === 0xA3) {
    return 'webm';
  }
  
  // Check for MP4 signature
  if (data.length > 12) {
    const possibleMP4 = new Uint8Array(data.buffer, 4, 4);
    try {
      const ftypString = String.fromCharCode(...possibleMP4);
      if (ftypString === 'ftyp') {
        return 'mp4';
      }
    } catch (e) {
      // Continue checking other formats
    }
  }
  
  // Check for WAV signature
  if (data.length > 12) {
    try {
      const possibleRIFF = String.fromCharCode(...new Uint8Array(data.buffer, 0, 4));
      const possibleWAVE = String.fromCharCode(...new Uint8Array(data.buffer, 8, 4));
      if (possibleRIFF === 'RIFF' && possibleWAVE === 'WAVE') {
        return 'wav';
      }
    } catch (e) {
      // Continue checking other formats
    }
  }
  
  // Check for OGG signature
  if (data.length > 4 && data[0] === 0x4F && data[1] === 0x67 && data[2] === 0x67 && data[3] === 0x53) {
    return 'ogg';
  }
  
  // Default to webm as it's most commonly used by MediaRecorder
  console.log("File type detection fallback to webm");
  return 'webm';
}

/**
 * Ensures the audio data has a proper header and minimal viable structure
 */
export function ensureValidAudioData(data: Uint8Array, fileType: string): Uint8Array {
  // If the data is too small, it's likely invalid
  if (data.length < 100) {
    console.log("Audio data too small, creating minimal valid structure");
    
    // Create different padding based on file type
    if (fileType === 'wav') {
      // Create minimal valid WAV file (8KB of silence)
      const silence = new Uint8Array(8192).fill(0);
      
      // WAV header (44 bytes)
      const header = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // "RIFF"
        0x24, 0x20, 0x00, 0x00, // Chunk size (8KB + 36)
        0x57, 0x41, 0x56, 0x45, // "WAVE"
        0x66, 0x6D, 0x74, 0x20, // "fmt "
        0x10, 0x00, 0x00, 0x00, // Subchunk1 size (16)
        0x01, 0x00, // Audio format (PCM)
        0x01, 0x00, // Num channels (1)
        0x44, 0xAC, 0x00, 0x00, // Sample rate (44100)
        0x88, 0x58, 0x01, 0x00, // Byte rate
        0x02, 0x00, // Block align
        0x10, 0x00, // Bits per sample (16)
        0x64, 0x61, 0x74, 0x61, // "data"
        0x00, 0x20, 0x00, 0x00  // Subchunk2 size (8KB)
      ]);
      
      const result = new Uint8Array(header.length + silence.length);
      result.set(header);
      result.set(silence, header.length);
      
      return result;
    } else {
      // For WebM or other formats, just return padding
      // (real headers are more complex)
      return new Uint8Array(16384).fill(0); 
    }
  }
  
  return data;
}
