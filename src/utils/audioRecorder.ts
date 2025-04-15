
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
  
  // Find the first supported MIME type
  const mimeTypes = [
    'audio/wav',              // Try WAV first as it's more reliable for duration
    'audio/webm;codecs=opus', // Second choice
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
  
  // Start recording immediately with smaller timeslice for mobile
  // Smaller timeslice ensures we get data quicker and more frequently
  mediaRecorder.start(100);
  
  // Define the stop method that will return a Promise with the audio URL
  const stop = () => {
    return new Promise<{ audioUrl: string, blob: Blob }>((resolve) => {
      mediaRecorder.addEventListener('stop', () => {
        // Calculate precise duration in seconds
        const actualDuration = (Date.now() - startTime - totalPausedTime) / 1000;
        console.log(`[audioRecorder] Calculated audio duration: ${actualDuration.toFixed(3)}s`);
        
        // Create a new blob combining all chunks - use WAV if possible for better duration support
        let mimeTypeToUse = mediaRecorder.mimeType;
        
        if (MediaRecorder.isTypeSupported('audio/wav')) {
          mimeTypeToUse = 'audio/wav';
        }
        
        console.log(`[audioRecorder] Creating blob with type: ${mimeTypeToUse}`);
        const audioBlob = new Blob(audioChunks, { type: mimeTypeToUse });
        
        // Force create a new blob and immediately set duration property
        const blobWithDuration = new Blob([audioBlob], { type: mimeTypeToUse });
        
        // Explicitly set the duration on the blob using defineProp
        // This is the crucial part that needs to work properly
        Object.defineProperty(blobWithDuration, 'duration', {
          value: Math.max(0.5, actualDuration), // Ensure minimum duration of 0.5s
          writable: false,
          configurable: true,
          enumerable: true
        });
        
        // Double check the duration was set
        const durationSet = (blobWithDuration as any).duration;
        console.log(`[audioRecorder] Audio blob created: ${blobWithDuration.size} bytes, type: ${blobWithDuration.type}, duration: ${durationSet}s`);
        
        if (durationSet === undefined || durationSet < 0.1) {
          console.warn('[audioRecorder] Failed to set duration directly, trying another approach');
          
          // Alternative approach
          const finalBlob = new Blob([blobWithDuration], { type: mimeTypeToUse });
          // Set duration using a different approach
          (finalBlob as any).duration = Math.max(0.5, actualDuration);
          
          console.log(`[audioRecorder] Second attempt to set duration: ${(finalBlob as any).duration}s`);
          const audioUrl = URL.createObjectURL(finalBlob);
          
          // Release microphone
          stream.getTracks().forEach(track => track.stop());
          
          resolve({ audioUrl, blob: finalBlob });
        } else {
          // Success case
          const audioUrl = URL.createObjectURL(blobWithDuration);
          
          // Release microphone
          stream.getTracks().forEach(track => track.stop());
          
          resolve({ audioUrl, blob: blobWithDuration });
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
