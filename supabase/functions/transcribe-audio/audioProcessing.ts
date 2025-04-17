
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
    
    // Verify the processed data is not empty
    if (totalLength === 0) {
      throw new Error('Processed audio data is empty');
    }
    
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
    
    // Log first few bytes for debugging
    const first8Bytes = Array.from(binaryData.slice(0, 8))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    console.log('First 8 bytes of audio data:', first8Bytes);
    
    // Check for MP4 signature (special case, offset 4)
    if (binaryData.length > 8) {
      let possibleMp4 = true;
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
    
    // If format detection fails, try to find "OggS" anywhere in the data (for Ogg files)
    const ogg = [0x4F, 0x67, 0x67, 0x53]; // "OggS"
    for (let i = 0; i < Math.min(binaryData.length - 4, 100); i++) { // Check only first 100 bytes
      let matchesOgg = true;
      for (let j = 0; j < ogg.length; j++) {
        if (binaryData[i + j] !== ogg[j]) {
          matchesOgg = false;
          break;
        }
      }
      if (matchesOgg) return 'ogg';
    }
    
    // Default to wav if we can't detect the type, as it's widely supported
    console.log('Could not detect audio file type, defaulting to wav');
    return 'wav';
  } catch (error) {
    console.error('Error detecting file type:', error);
    return 'wav'; // Default to wav on error as it's more widely supported by OpenAI
  }
}

/**
 * Verify if the audio data appears to be valid before sending to OpenAI
 * @param binaryData - The processed binary audio data
 * @returns True if data appears valid, false otherwise
 */
export function isValidAudioData(binaryData: Uint8Array): boolean {
  // Check if data is too small to be valid audio
  if (!binaryData || binaryData.length < 100) {
    console.error('Audio data too small to be valid:', binaryData?.length || 0);
    return false;
  }
  
  // Check for all zeros or repeating patterns which might indicate corruption
  let allZeros = true;
  let repeatingPattern = true;
  const patternLength = 10; // Check for repeating patterns of this length
  
  for (let i = 0; i < Math.min(1000, binaryData.length); i++) {
    // Check if not all zeros
    if (binaryData[i] !== 0) {
      allZeros = false;
    }
    
    // Check for non-repeating pattern
    if (i >= patternLength && 
        binaryData[i] !== binaryData[i - patternLength]) {
      repeatingPattern = false;
    }
    
    // If we've verified it's neither all zeros nor a repeating pattern, we can stop checking
    if (!allZeros && !repeatingPattern && i > 100) {
      break;
    }
  }
  
  if (allZeros) {
    console.error('Audio data appears to be all zeros');
    return false;
  }
  
  if (repeatingPattern) {
    console.error('Audio data appears to have a simple repeating pattern');
    return false;
  }
  
  return true;
}
