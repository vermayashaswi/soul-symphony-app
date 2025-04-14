
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
    const chunks: Uint8Array[] = [];
    let position = 0;
    
    while (position < base64String.length) {
      const chunk = base64String.slice(position, position + chunkSize);
      const binaryChunk = atob(chunk);
      const bytes = new Uint8Array(binaryChunk.length);
      
      for (let i = 0; i < binaryChunk.length; i++) {
        bytes[i] = binaryChunk.charCodeAt(i);
      }
      
      chunks.push(bytes);
      position += chunkSize;
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    // If the resulting array is too small, add padding
    if (result.length < 1000) {
      console.log("Audio data very small, adding padding");
      const paddedResult = new Uint8Array(result.length + 8192);
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
    throw new Error('Failed to process audio data');
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
    const ftypString = String.fromCharCode(...possibleMP4);
    if (ftypString === 'ftyp') {
      return 'mp4';
    }
  }
  
  // Check for WAV signature
  if (data.length > 12) {
    const possibleRIFF = String.fromCharCode(...new Uint8Array(data.buffer, 0, 4));
    const possibleWAVE = String.fromCharCode(...new Uint8Array(data.buffer, 8, 4));
    if (possibleRIFF === 'RIFF' && possibleWAVE === 'WAVE') {
      return 'wav';
    }
  }
  
  // Default to webm as it's most commonly used by MediaRecorder
  console.log("File type detection fallback to webm");
  return 'webm';
}
