
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
      sampleRate: 44100,
      channelCount: 1
    }
  });
  
  // Find the first supported MIME type - prioritize WAV format
  const mimeTypes = [
    'audio/wav',              // WAV format is most reliable for duration
    'audio/webm;codecs=opus', 
    'audio/mp4',              
    'audio/ogg;codecs=opus',  
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
    audioBitsPerSecond: 128000 
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
  let isRecording = true; // Track recording state
  
  // Add data to chunks when available
  mediaRecorder.addEventListener('dataavailable', (event) => {
    if (event.data && event.data.size > 0) {
      audioChunks.push(event.data);
    }
  });
  
  // Start recording immediately with smaller timeslice for mobile
  mediaRecorder.start(100);
  
  // Define the stop method that will return a Promise with the audio URL
  const stop = () => {
    return new Promise<{ audioUrl: string, blob: Blob }>((resolve) => {
      if (!isRecording) {
        console.warn('[audioRecorder] Stop called but recorder is not in recording state');
        // If already stopped, create an empty blob to prevent hanging
        const emptyBlob = new Blob([], { type: mediaRecorder.mimeType });
        resolve({ audioUrl: URL.createObjectURL(emptyBlob), blob: emptyBlob });
        return;
      }
      
      isRecording = false; // Mark as not recording immediately
      
      // Create a safety timeout to ensure we don't hang if stop event doesn't fire
      const stopTimeout = setTimeout(() => {
        console.warn('[audioRecorder] Stop event timed out, forcing cleanup');
        // Force cleanup and resolve with what we have
        const finalBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        stream.getTracks().forEach(track => track.stop());
        resolve({ audioUrl: URL.createObjectURL(finalBlob), blob: finalBlob });
      }, 3000);
      
      mediaRecorder.addEventListener('stop', () => {
        clearTimeout(stopTimeout);
        
        // Calculate precise duration in seconds
        const actualDuration = (Date.now() - startTime - totalPausedTime) / 1000;
        console.log(`[audioRecorder] Calculated audio duration: ${actualDuration.toFixed(3)}s`);
        
        // Use WAV if possible for better duration support
        let mimeTypeToUse = mediaRecorder.mimeType;
        if (MediaRecorder.isTypeSupported('audio/wav')) {
          mimeTypeToUse = 'audio/wav';
        }
        
        console.log(`[audioRecorder] Creating blob with type: ${mimeTypeToUse}`);
        const audioBlob = new Blob(audioChunks, { type: mimeTypeToUse });
        
        // Force create a new blob and set duration property
        const blobWithDuration = new Blob([audioBlob], { type: mimeTypeToUse });
        
        // Set the duration in multiple ways to ensure it sticks
        // First as a direct property
        Object.defineProperty(blobWithDuration, 'duration', {
          value: Math.max(0.5, actualDuration),
          writable: false,
          configurable: true,
          enumerable: true
        });
        
        // Also as a data attribute
        Object.defineProperty(blobWithDuration, '_audioDuration', {
          value: Math.max(0.5, actualDuration),
          writable: false,
          configurable: true, 
          enumerable: true
        });
        
        // Double check the duration was set
        const durationSet = (blobWithDuration as any).duration;
        console.log(`[audioRecorder] Audio blob created: ${blobWithDuration.size} bytes, type: ${blobWithDuration.type}, duration: ${durationSet}s`);
        
        // Create the audio URL
        const audioUrl = URL.createObjectURL(blobWithDuration);
        
        // Ensure all tracks are properly stopped
        stream.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            console.log(`[audioRecorder] Stopping track: ${track.kind}`);
            track.stop();
          }
        });
        
        resolve({ audioUrl, blob: blobWithDuration });
      });
      
      if (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused') {
        console.log('[audioRecorder] Stopping MediaRecorder');
        try {
          mediaRecorder.stop();
        } catch (e) {
          console.error('[audioRecorder] Error stopping MediaRecorder', e);
          // Force cleanup in case of error
          stream.getTracks().forEach(track => track.stop());
          const finalBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
          resolve({ audioUrl: URL.createObjectURL(finalBlob), blob: finalBlob });
        }
      } else {
        console.warn(`[audioRecorder] MediaRecorder in unexpected state: ${mediaRecorder.state}`);
        // Force cleanup in case of unexpected state
        stream.getTracks().forEach(track => track.stop());
        const finalBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        resolve({ audioUrl: URL.createObjectURL(finalBlob), blob: finalBlob });
      }
    });
  };
  
  // Return an object with methods to control the recorder
  return {
    start: () => {
      if (mediaRecorder.state !== 'recording' && isRecording) {
        startTime = Date.now() - totalPausedTime; // Adjust start time if there were pauses
        mediaRecorder.start(100);
      }
    },
    stop,
    pause: () => {
      if (mediaRecorder.state === 'recording' && isRecording) {
        pauseTime = Date.now();
        mediaRecorder.pause();
        return true;
      }
      return false;
    },
    resume: () => {
      if (mediaRecorder.state === 'paused' && isRecording) {
        totalPausedTime += (Date.now() - pauseTime);
        mediaRecorder.resume();
        return true;
      }
      return false;
    },
    stream,
    getState: () => mediaRecorder.state,
    forceStop: () => {
      isRecording = false;
      if (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused') {
        try {
          mediaRecorder.stop();
        } catch (e) {
          console.warn('[audioRecorder] Error in forceStop', e);
        }
      }
      stream.getTracks().forEach(track => track.stop());
    }
  };
};
