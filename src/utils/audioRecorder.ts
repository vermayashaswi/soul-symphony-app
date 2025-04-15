
/**
 * Audio recording utility for voice messages
 */
export const recordAudio = async () => {
  // Check if browser supports audio recording
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Audio recording not supported in this browser');
  }
  
  // Request microphone access with optimized settings
  const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });
  
  // Try multiple MIME types in order of preference
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus'
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
  const options: MediaRecorderOptions = {};
  
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
        // Create audio blob and get its URL
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm;codecs=opus' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Calculate duration and set it directly on the blob
        const duration = (Date.now() - startTime) / 1000;
        console.log(`[audioRecorder] Calculated audio duration: ${duration}s`);
        
        // Set duration property on the blob
        Object.defineProperty(audioBlob, 'duration', {
          value: duration,
          writable: false,
          configurable: true
        });
        
        // Release microphone
        stream.getTracks().forEach(track => track.stop());
        
        resolve({ audioUrl, blob: audioBlob });
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
        startTime = Date.now(); // Reset start time when recording is started
        mediaRecorder.start(100);
      }
    },
    stop,
    pause: () => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
        return true;
      }
      return false;
    },
    resume: () => {
      if (mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
        return true;
      }
      return false;
    },
    stream,
    getState: () => mediaRecorder.state
  };
};
