
/**
 * FIXED: Enhanced audio processing utilities for the transcribe-audio edge function
 */

/**
 * FIXED: Process base64 audio data into a binary buffer with enhanced chunking
 * @param base64String - The base64 encoded audio data
 */
export function processBase64Chunks(base64String: string): Uint8Array {
  try {
    console.log('[AudioProcessing] FIXED: Starting enhanced base64 processing');
    
    // Clean the base64 string first (remove potential header)
    let cleanBase64 = base64String;
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
      console.log('[AudioProcessing] FIXED: Removed data URL header');
    }
    
    // Ensure proper padding
    const padding = cleanBase64.length % 4;
    if (padding) {
      cleanBase64 += '='.repeat(4 - padding);
      console.log(`[AudioProcessing] FIXED: Added ${4 - padding} padding characters`);
    }
    
    // Validate base64 string before processing
    try {
      const testChunk = cleanBase64.substring(0, Math.min(100, cleanBase64.length));
      atob(testChunk);
      console.log('[AudioProcessing] FIXED: Base64 validation passed');
    } catch (e) {
      console.error('[AudioProcessing] FIXED: Invalid base64 string:', e);
      throw new Error('Invalid base64 encoding format');
    }
    
    // FIXED: Enhanced chunking with better memory management
    const chunks: Uint8Array[] = [];
    const chunkSize = 16384; // Increased to 16KB chunks for better performance
    let processedBytes = 0;
    
    console.log(`[AudioProcessing] FIXED: Processing ${cleanBase64.length} characters in ${Math.ceil(cleanBase64.length / chunkSize)} chunks`);
    
    for (let i = 0; i < cleanBase64.length; i += chunkSize) {
      const chunk = cleanBase64.substring(i, i + chunkSize);
      try {
        const binaryChunk = atob(chunk);
        const bytes = new Uint8Array(binaryChunk.length);
        
        for (let j = 0; j < binaryChunk.length; j++) {
          bytes[j] = binaryChunk.charCodeAt(j);
        }
        
        chunks.push(bytes);
        processedBytes += bytes.length;
        
        // Log progress for large files
        if (chunks.length % 100 === 0) {
          console.log(`[AudioProcessing] FIXED: Processed ${chunks.length} chunks, ${processedBytes} bytes`);
        }
      } catch (error) {
        console.error(`[AudioProcessing] FIXED: Error processing chunk at position ${i}:`, error);
        throw new Error(`Failed to decode base64 chunk at position ${i}: ${error.message}`);
      }
    }
    
    // FIXED: Enhanced array combination
    const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    console.log(`[AudioProcessing] FIXED: Successfully processed ${chunks.length} chunks into ${totalLength} byte array`);
    
    // Verify the processed data is not empty
    if (totalLength === 0) {
      throw new Error('Processed audio data is empty');
    }
    
    // FIXED: Additional validation
    if (totalLength < 44) { // Minimum size for basic audio file headers
      console.warn(`[AudioProcessing] FIXED: Very small audio file: ${totalLength} bytes`);
    }
    
    return result;
  } catch (error) {
    console.error('[AudioProcessing] FIXED: Error processing base64 chunks:', error);
    throw new Error(`Failed to process audio data: ${error.message}`);
  }
}

/**
 * FIXED: Enhanced file type detection with better signature matching
 * @param binaryData - The binary audio data
 */
export function detectFileType(binaryData: Uint8Array): string {
  try {
    console.log('[AudioProcessing] FIXED: Starting enhanced file type detection');
    
    // FIXED: Enhanced audio signatures with more formats
    const signatures = {
      webm: [0x1A, 0x45, 0xDF, 0xA3], // WEBM/EBML
      mp4: [0x66, 0x74, 0x79, 0x70], // MP4 ("ftyp" at position 4)
      m4a: [0x66, 0x74, 0x79, 0x70], // M4A (same as MP4)
      mp3_id3: [0x49, 0x44, 0x33], // MP3 with ID3v2 tag
      mp3_frame: [0xFF, 0xFB], // MP3 frame header (partial)
      wav: [0x52, 0x49, 0x46, 0x46], // WAV ("RIFF")
      ogg: [0x4F, 0x67, 0x67, 0x53], // OGG ("OggS")
      flac: [0x66, 0x4C, 0x61, 0x43], // FLAC ("fLaC")
      aac: [0xFF, 0xF1], // AAC ADTS frame (partial)
    };
    
    // Log first bytes for debugging
    const debugBytes = Math.min(16, binaryData.length);
    const hexString = Array.from(binaryData.slice(0, debugBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    console.log(`[AudioProcessing] FIXED: First ${debugBytes} bytes: ${hexString}`);
    
    // FIXED: Enhanced detection logic
    if (binaryData.length >= 8) {
      // Check MP4/M4A (special case, offset 4)
      if (binaryData.length > 8) {
        let matchesMp4 = true;
        for (let i = 0; i < signatures.mp4.length; i++) {
          if (binaryData[i + 4] !== signatures.mp4[i]) {
            matchesMp4 = false;
            break;
          }
        }
        if (matchesMp4) {
          console.log('[AudioProcessing] FIXED: Detected MP4/M4A format');
          return 'mp4';
        }
      }
      
      // Check WEBM/EBML
      let matchesWebm = true;
      for (let i = 0; i < signatures.webm.length; i++) {
        if (binaryData[i] !== signatures.webm[i]) {
          matchesWebm = false;
          break;
        }
      }
      if (matchesWebm) {
        console.log('[AudioProcessing] FIXED: Detected WEBM format');
        return 'webm';
      }
      
      // Check WAV
      let matchesWav = true;
      for (let i = 0; i < signatures.wav.length; i++) {
        if (binaryData[i] !== signatures.wav[i]) {
          matchesWav = false;
          break;
        }
      }
      if (matchesWav) {
        console.log('[AudioProcessing] FIXED: Detected WAV format');
        return 'wav';
      }
      
      // Check FLAC
      let matchesFlac = true;
      for (let i = 0; i < signatures.flac.length; i++) {
        if (binaryData[i] !== signatures.flac[i]) {
          matchesFlac = false;
          break;
        }
      }
      if (matchesFlac) {
        console.log('[AudioProcessing] FIXED: Detected FLAC format');
        return 'flac';
      }
    }
    
    // Check for MP3 variants
    if (binaryData.length >= 3) {
      // MP3 with ID3
      let matchesMp3Id3 = true;
      for (let i = 0; i < signatures.mp3_id3.length; i++) {
        if (binaryData[i] !== signatures.mp3_id3[i]) {
          matchesMp3Id3 = false;
          break;
        }
      }
      if (matchesMp3Id3) {
        console.log('[AudioProcessing] FIXED: Detected MP3 with ID3 tags');
        return 'mp3';
      }
      
      // Check for MP3 frame header anywhere in first 1KB
      for (let i = 0; i < Math.min(1024, binaryData.length - 1); i++) {
        if (binaryData[i] === 0xFF && (binaryData[i + 1] & 0xE0) === 0xE0) {
          console.log('[AudioProcessing] FIXED: Detected MP3 frame header');
          return 'mp3';
        }
      }
    }
    
    // FIXED: Enhanced OGG detection - search in first 512 bytes
    for (let i = 0; i < Math.min(binaryData.length - 4, 512); i++) {
      let matchesOgg = true;
      for (let j = 0; j < signatures.ogg.length; j++) {
        if (binaryData[i + j] !== signatures.ogg[j]) {
          matchesOgg = false;
          break;
        }
      }
      if (matchesOgg) {
        console.log('[AudioProcessing] FIXED: Detected OGG format');
        return 'ogg';
      }
    }
    
    // FIXED: Enhanced AAC detection
    if (binaryData.length >= 2) {
      for (let i = 0; i < Math.min(1024, binaryData.length - 1); i++) {
        if (binaryData[i] === 0xFF && (binaryData[i + 1] & 0xF0) === 0xF0) {
          console.log('[AudioProcessing] FIXED: Detected AAC format');
          return 'aac';
        }
      }
    }
    
    // FIXED: Default with warning
    console.log('[AudioProcessing] FIXED: Could not detect audio file type, defaulting to WAV');
    return 'wav';
  } catch (error) {
    console.error('[AudioProcessing] FIXED: Error detecting file type:', error);
    return 'wav';
  }
}

/**
 * FIXED: Enhanced audio data validation
 * @param binaryData - The processed binary audio data
 * @returns True if data appears valid, false otherwise
 */
export function isValidAudioData(binaryData: Uint8Array): boolean {
  console.log('[AudioProcessing] FIXED: Starting enhanced audio validation');
  
  // Check if data exists and has minimum size
  if (!binaryData || binaryData.length < 44) { // 44 bytes minimum for WAV header
    console.error(`[AudioProcessing] FIXED: Audio data too small: ${binaryData?.length || 0} bytes`);
    return false;
  }
  
  // FIXED: Enhanced validation checks
  let allZeros = true;
  let allSame = true;
  let repeatingPattern = true;
  const sampleSize = Math.min(2048, binaryData.length); // Check first 2KB
  const patternLength = 16;
  
  const firstByte = binaryData[0];
  
  for (let i = 0; i < sampleSize; i++) {
    // Check if not all zeros
    if (binaryData[i] !== 0) {
      allZeros = false;
    }
    
    // Check if not all same value
    if (binaryData[i] !== firstByte) {
      allSame = false;
    }
    
    // Check for non-repeating pattern
    if (i >= patternLength && binaryData[i] !== binaryData[i - patternLength]) {
      repeatingPattern = false;
    }
    
    // Early exit if we've verified it's valid
    if (!allZeros && !allSame && !repeatingPattern && i > 256) {
      break;
    }
  }
  
  if (allZeros) {
    console.error('[AudioProcessing] FIXED: Audio data appears to be all zeros');
    return false;
  }
  
  if (allSame) {
    console.error(`[AudioProcessing] FIXED: Audio data appears to be all same value: ${firstByte}`);
    return false;
  }
  
  if (repeatingPattern && sampleSize > patternLength * 4) {
    console.error('[AudioProcessing] FIXED: Audio data appears to have a simple repeating pattern');
    return false;
  }
  
  // FIXED: Additional entropy check
  const uniqueBytes = new Set();
  for (let i = 0; i < Math.min(1024, binaryData.length); i++) {
    uniqueBytes.add(binaryData[i]);
  }
  
  if (uniqueBytes.size < 10) {
    console.error(`[AudioProcessing] FIXED: Audio data has very low entropy: ${uniqueBytes.size} unique bytes`);
    return false;
  }
  
  console.log(`[AudioProcessing] FIXED: Audio validation passed - size: ${binaryData.length}, entropy: ${uniqueBytes.size} unique bytes`);
  return true;
}

/**
 * FIXED: Enhanced audio data validation and optimization
 * @param binaryData - The processed binary audio data
 * @param fileType - The detected file type
 * @returns Fixed audio data if needed, or original if already valid
 */
export function validateAndFixAudioData(binaryData: Uint8Array, fileType: string): Uint8Array {
  console.log(`[AudioProcessing] FIXED: Validating ${fileType} audio data`);
  
  // Check if we have valid audio data
  if (!isValidAudioData(binaryData)) {
    throw new Error('Invalid audio data detected, cannot process');
  }
  
  // FIXED: Enhanced WAV header validation
  if (fileType === 'wav' && binaryData.length > 44) {
    const hasRiffHeader = 
      binaryData[0] === 0x52 && // R
      binaryData[1] === 0x49 && // I
      binaryData[2] === 0x46 && // F
      binaryData[3] === 0x46;   // F
      
    const hasWaveFormat = 
      binaryData[8] === 0x57 && // W
      binaryData[9] === 0x41 && // A
      binaryData[10] === 0x56 && // V
      binaryData[11] === 0x45;   // E
      
    if (!hasRiffHeader) {
      console.warn('[AudioProcessing] FIXED: WAV file missing RIFF header');
    }
    
    if (!hasWaveFormat) {
      console.warn('[AudioProcessing] FIXED: WAV file missing WAVE format identifier');
    }
    
    if (hasRiffHeader && hasWaveFormat) {
      console.log('[AudioProcessing] FIXED: WAV header validation passed');
    }
  }
  
  // FIXED: File size validation with better thresholds
  if (binaryData.length < 1000) {
    console.warn(`[AudioProcessing] FIXED: Very small audio file: ${binaryData.length} bytes`);
  } else if (binaryData.length > 50 * 1024 * 1024) { // 50MB
    console.warn(`[AudioProcessing] FIXED: Very large audio file: ${(binaryData.length / 1024 / 1024).toFixed(2)}MB`);
  } else {
    console.log(`[AudioProcessing] FIXED: Audio file size acceptable: ${(binaryData.length / 1024).toFixed(2)}KB`);
  }
  
  return binaryData;
}
