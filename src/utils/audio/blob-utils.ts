
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
 * Adds 1 second of silence padding to the end of an audio blob
 * @param blob Original audio blob
 * @returns Audio blob with 1 second of silence appended
 */
export async function addSilencePadding(blob: Blob): Promise<Blob> {
  try {
    console.log('[BlobUtils] Adding 1-second silence padding to audio');
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    const originalLength = audioBuffer.length;
    const silenceDuration = 1.0; // 1 second
    const silenceLength = Math.floor(sampleRate * silenceDuration);
    const newLength = originalLength + silenceLength;
    
    // Create new buffer with extra space for silence
    const newBuffer = audioContext.createBuffer(channels, newLength, sampleRate);
    
    // Copy original audio data
    for (let channel = 0; channel < channels; channel++) {
      const originalData = audioBuffer.getChannelData(channel);
      const newData = newBuffer.getChannelData(channel);
      
      // Copy original audio
      newData.set(originalData, 0);
      
      // The remaining space is already filled with zeros (silence)
    }
    
    // Convert back to blob
    const offlineContext = new OfflineAudioContext(channels, newLength, sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = newBuffer;
    source.connect(offlineContext.destination);
    source.start(0);
    
    const renderedBuffer = await offlineContext.startRendering();
    
    // Convert to WAV format for consistency
    const wavBlob = await audioBufferToWav(renderedBuffer);
    
    console.log('[BlobUtils] Successfully added silence padding:', {
      originalSize: blob.size,
      newSize: wavBlob.size,
      originalDuration: originalLength / sampleRate,
      newDuration: newLength / sampleRate
    });
    
    return wavBlob;
    
  } catch (error) {
    console.warn('[BlobUtils] Failed to add silence padding, returning original blob:', error);
    return blob; // Fallback to original blob if padding fails
  }
}

/**
 * Converts AudioBuffer to WAV blob
 * @param buffer The audio buffer to convert
 * @returns WAV blob
 */
async function audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const bufferSize = 44 + dataSize;
  
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Convert audio data
  const offset = 44;
  const channels = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  
  let pos = 0;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(offset + pos, sample * 0x7FFF, true);
      pos += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
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
