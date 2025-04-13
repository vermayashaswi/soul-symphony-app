
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
  if (data.length > 4 && data[0] === 0x1A && data[1] === 0x45 && data[2] === 0xDF && data[3] === 0xA3) {
    return 'webm';
  }
  
  if (data.length > 12) {
    const possibleMP4 = new Uint8Array(data.buffer, 4, 4);
    const ftypString = String.fromCharCode(...possibleMP4);
    if (ftypString === 'ftyp') {
      return 'mp4';
    }
  }
  
  if (data.length > 12) {
    const possibleRIFF = String.fromCharCode(...new Uint8Array(data.buffer, 0, 4));
    const possibleWAVE = String.fromCharCode(...new Uint8Array(data.buffer, 8, 4));
    if (possibleRIFF === 'RIFF' && possibleWAVE === 'WAVE') {
      return 'wav';
    }
  }
  
  return 'mp4';
}
