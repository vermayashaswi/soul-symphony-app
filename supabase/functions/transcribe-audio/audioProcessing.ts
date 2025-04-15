
/**
 * Audio processing utilities for the transcribe-audio edge function
 */

/**
 * Process base64 audio data into a binary buffer
 * - Handles chunking to prevent memory issues with large audio files
 * @param base64String - The base64 encoded audio data
 */
export function processBase64Chunks(base64String: string): Uint8Array {
  try {
    // Clean the base64 string first (remove potential header)
    let cleanBase64 = base64String;
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    
    // Ensure proper padding
    const padding = cleanBase64.length % 4;
    if (padding) {
      cleanBase64 += '='.repeat(4 - padding);
    }
    
    // Process in chunks to prevent memory issues with large files
    const chunks: Uint8Array[] = [];
    const chunkSize = 8192; // Process 8KB at a time
    
    for (let i = 0; i < cleanBase64.length; i += chunkSize) {
      const chunk = cleanBase64.substring(i, i + chunkSize);
      try {
        const binaryChunk = atob(chunk);
        const bytes = new Uint8Array(binaryChunk.length);
        
        for (let j = 0; j < binaryChunk.length; j++) {
          bytes[j] = binaryChunk.charCodeAt(j);
        }
        
        chunks.push(bytes);
      } catch (error) {
        console.error('Error processing chunk at position', i, ':', error);
        throw new Error(`Failed to decode base64 chunk at position ${i}: ${error.message}`);
      }
    }
    
    // Combine chunks into a single array
    const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    console.log(`Processed ${chunks.length} chunks into a ${totalLength} byte array`);
    return result;
  } catch (error) {
    console.error('Error processing base64 chunks:', error);
    throw new Error(`Failed to process audio data: ${error.message}`);
  }
}

/**
 * Detect the file type of audio data based on its binary signature
 * @param binaryData - The binary audio data
 */
export function detectFileType(binaryData: Uint8Array): string {
  try {
    // Most common audio signatures
    const signatures = {
      webm: [0x1A, 0x45, 0xDF, 0xA3], // WEBM
      mp4: [0x66, 0x74, 0x79, 0x70], // MP4 (checking for "ftyp" at position 4)
      mp3: [0x49, 0x44, 0x33], // MP3 with ID3v2 tag
      wav: [0x52, 0x49, 0x46, 0x46] // WAV ("RIFF")
    };
    
    // Check for MP4 signature (special case, offset 4)
    if (binaryData.length > 8) {
      const possibleMp4 = true;
      for (let i = 0; i < signatures.mp4.length; i++) {
        if (binaryData[i + 4] !== signatures.mp4[i]) {
          possibleMp4 = false;
          break;
        }
      }
      if (possibleMp4) return 'mp4';
    }
    
    // Check for other formats
    if (binaryData.length >= 4) {
      // Check WEBM
      let matchesWebm = true;
      for (let i = 0; i < signatures.webm.length; i++) {
        if (binaryData[i] !== signatures.webm[i]) {
          matchesWebm = false;
          break;
        }
      }
      if (matchesWebm) return 'webm';
      
      // Check WAV
      let matchesWav = true;
      for (let i = 0; i < signatures.wav.length; i++) {
        if (binaryData[i] !== signatures.wav[i]) {
          matchesWav = false;
          break;
        }
      }
      if (matchesWav) return 'wav';
    }
    
    // Check for MP3
    if (binaryData.length >= 3) {
      let matchesMp3 = true;
      for (let i = 0; i < signatures.mp3.length; i++) {
        if (binaryData[i] !== signatures.mp3[i]) {
          matchesMp3 = false;
          break;
        }
      }
      if (matchesMp3) return 'mp3';
    }
    
    // Default to webm if we can't detect the type
    console.log('Could not detect audio file type, defaulting to webm');
    return 'webm';
  } catch (error) {
    console.error('Error detecting file type:', error);
    return 'webm'; // Default to webm on error
  }
}
