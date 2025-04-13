
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
    // Clean any data URL prefix if present
    let cleanBase64 = base64String;
    if (base64String.includes(',')) {
      cleanBase64 = base64String.split(',')[1];
    }
    
    console.log(`Processing base64 data of length: ${cleanBase64.length}`);
    
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
      } catch (chunkError) {
        console.error('Error processing chunk at position', position, 'Error:', chunkError);
        // Skip this chunk and continue
      }
      
      position += chunkSize;
    }

    if (chunks.length === 0) {
      console.error('No valid base64 chunks processed');
      return new Uint8Array(0);
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    console.log(`Total processed binary length: ${totalLength} bytes`);
    
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
  if (data.length === 0) {
    console.error('Empty data provided to detectFileType');
    return 'webm'; // Default to webm
  }
  
  try {
    if (data.length > 4 && data[0] === 0x1A && data[1] === 0x45 && data[2] === 0xDF && data[3] === 0xA3) {
      console.log('Detected file type: webm');
      return 'webm';
    }
    
    if (data.length > 12) {
      const possibleMP4 = new Uint8Array(data.buffer, 4, 4);
      try {
        const ftypString = String.fromCharCode(...possibleMP4);
        if (ftypString === 'ftyp') {
          console.log('Detected file type: mp4');
          return 'mp4';
        }
      } catch (e) {
        console.error('Error checking MP4 signature:', e);
      }
    }
    
    if (data.length > 12) {
      try {
        const possibleRIFF = String.fromCharCode(...new Uint8Array(data.buffer, 0, 4));
        const possibleWAVE = String.fromCharCode(...new Uint8Array(data.buffer, 8, 4));
        if (possibleRIFF === 'RIFF' && possibleWAVE === 'WAVE') {
          console.log('Detected file type: wav');
          return 'wav';
        }
      } catch (e) {
        console.error('Error checking WAV signature:', e);
      }
    }
    
    console.log('Unable to detect file type, defaulting to mp4');
    return 'mp4';
  } catch (error) {
    console.error('Error in detectFileType:', error);
    return 'webm'; // Default to webm as fallback
  }
}
