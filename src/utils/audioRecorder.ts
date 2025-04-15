
/**
 * Audio recording utility for voice messages
 */
export const recordAudio = async () => {
  // Check if browser supports audio recording
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Audio recording not supported in this browser');
  }
  
  // Request microphone access with optimized settings for higher quality
  const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 44100, // Standard sample rate for better compatibility
      channelCount: 1    // Mono for smaller file size and better compatibility
    }
  });
  
  // Try multiple MIME types in order of preference
  const mimeTypes = [
    'audio/webm;codecs=opus', // Best quality and compression
    'audio/mp4',              // Good iOS support
    'audio/ogg;codecs=opus',  // Good quality fallback
    'audio/wav'               // Universal compatibility 
  ];
  
  // Find the first supported MIME type
  let mimeType = '';
  for (const type of mimeTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      mimeType = type;
      break;
    }
  }
  
  console.log(`[audioRecorder] Using MIME type: ${mimeType || 'default browser MIME type'}`);
  
  // Set up MediaRecorder with best supported options
  const options: MediaRecorderOptions = {
    audioBitsPerSecond: 128000 // Consistent bitrate for better compatibility
  };
  
  // Only add mime type if we found a supported one
  if (mimeType) {
    options.mimeType = mimeType;
  }
  
  // Create the MediaRecorder with proper error handling
  let mediaRecorder: MediaRecorder;
  try {
    mediaRecorder = new MediaRecorder(stream, options);
    console.log(`[audioRecorder] Recording with MIME type: ${mediaRecorder.mimeType}`);
  } catch (e) {
    console.warn('[audioRecorder] Failed to create MediaRecorder with specified options, using defaults', e);
    try {
      // Fallback to default options
      mediaRecorder = new MediaRecorder(stream);
      console.log(`[audioRecorder] Fallback: Recording with MIME type: ${mediaRecorder.mimeType}`);
    } catch (fallbackError) {
      console.error('[audioRecorder] Complete failure to create MediaRecorder', fallbackError);
      // Stop all tracks to release the microphone before throwing
      stream.getTracks().forEach(track => track.stop());
      throw new Error('Could not create audio recorder with your browser');
    }
  }
  
  const audioChunks: BlobPart[] = [];
  let startTime = Date.now();
  let pauseTime = 0;
  let totalPausedTime = 0;
  
  // Add data to chunks when available
  mediaRecorder.addEventListener('dataavailable', (event) => {
    if (event.data && event.data.size > 0) {
      audioChunks.push(event.data);
    }
  });
  
  // Start recording and immediately request first data chunk
  mediaRecorder.start(100); // Use 100ms timeslice to get frequent chunks
  
  // Define the stop method that will return a Promise with the audio URL
  const stop = () => {
    return new Promise<{ audioUrl: string, blob: Blob }>((resolve) => {
      mediaRecorder.addEventListener('stop', () => {
        // Calculate precise duration
        const actualDuration = (Date.now() - startTime - totalPausedTime) / 1000;
        console.log(`[audioRecorder] Calculated audio duration: ${actualDuration.toFixed(3)}s`);
        
        // Create audio blob with proper MIME type ensuring it's a format browsers can play
        let mimeTypeToUse = mediaRecorder.mimeType;
        
        // Ensure MIME type is valid and well-supported
        if (!mimeTypeToUse || mimeTypeToUse === 'audio/webm;codecs=opus') {
          // WebM is well-supported in most browsers but sometimes has duration issues
          // Force to mp3 or wav if WebM was used but had issues
          if (actualDuration < 0.5 && MediaRecorder.isTypeSupported('audio/wav')) {
            mimeTypeToUse = 'audio/wav';
          } else if (MediaRecorder.isTypeSupported('audio/mp3') || MediaRecorder.isTypeSupported('audio/mpeg')) {
            mimeTypeToUse = MediaRecorder.isTypeSupported('audio/mp3') ? 'audio/mp3' : 'audio/mpeg';
          }
        }
        
        console.log(`[audioRecorder] Creating blob with type: ${mimeTypeToUse}`);
        const audioBlob = new Blob(audioChunks, { type: mimeTypeToUse });
        
        // Create a new Blob with an explicit duration property
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Explicitly set the duration on the blob using defineProp since it won't be accessible otherwise
        Object.defineProperty(audioBlob, 'duration', {
          value: actualDuration,
          writable: false,
          configurable: true,
          enumerable: true // Make it enumerable so it shows up in logs
        });
        
        console.log(`[audioRecorder] Audio blob created: ${audioBlob.size} bytes, type: ${audioBlob.type}, duration: ${(audioBlob as any).duration}s`);
        
        // Verify the duration was set correctly
        if ((audioBlob as any).duration !== actualDuration) {
          console.warn('[audioRecorder] Duration property was not set correctly on the blob');
        }
        
        // Release microphone
        stream.getTracks().forEach(track => track.stop());
        
        // Check if duration was properly set before resolving
        if ((audioBlob as any).duration === undefined || (audioBlob as any).duration === null) {
          console.warn('[audioRecorder] Duration was not set on blob, attempting to set it again');
          // Try once more with different approach
          const blobWithDuration = new Blob([audioBlob], { type: audioBlob.type });
          Object.defineProperty(blobWithDuration, 'duration', {
            value: actualDuration,
            writable: false,
            configurable: true,
            enumerable: true
          });
          resolve({ audioUrl, blob: blobWithDuration });
        } else {
          resolve({ audioUrl, blob: audioBlob });
        }
      });
      
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    });
  };
  
  // Return an object with methods to control the recorder
  return {
    start: () => {
      if (mediaRecorder.state !== 'recording') {
        startTime = Date.now() - totalPausedTime; // Adjust start time if there were pauses
        mediaRecorder.start(100);
      }
    },
    stop,
    pause: () => {
      if (mediaRecorder.state === 'recording') {
        pauseTime = Date.now();
        mediaRecorder.pause();
        return true;
      }
      return false;
    },
    resume: () => {
      if (mediaRecorder.state === 'paused') {
        totalPausedTime += (Date.now() - pauseTime);
        mediaRecorder.resume();
        return true;
      }
      return false;
    },
    stream,
    getState: () => mediaRecorder.state
  };
};
