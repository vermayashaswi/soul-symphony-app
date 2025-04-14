
/**
 * Audio recording utility for voice messages
 */
export const recordAudio = async () => {
  // Check if browser supports audio recording
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Audio recording not supported in this browser');
  }
  
  // Request microphone access with more permissive settings
  // Not using advanced constraints which might fail on some devices
  const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: true
  });
  
  // Try multiple MIME types in order of preference
  const mimeTypes = [
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus', 
    'audio/webm;codecs=opus'
  ];
  
  // Find the first supported MIME type
  let mimeType = '';
  for (const type of mimeTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      mimeType = type;
      break;
    }
  }
  
  // Set up MediaRecorder with best supported options
  const options: MediaRecorderOptions = {
    audioBitsPerSecond: 128000 // Set reasonable bitrate
  };
  
  // Only add mime type if we found a supported one
  if (mimeType) {
    options.mimeType = mimeType;
  }
  
  // Create the MediaRecorder with proper error handling
  let mediaRecorder: MediaRecorder;
  try {
    mediaRecorder = new MediaRecorder(stream, options);
    console.log(`Recording with MIME type: ${mediaRecorder.mimeType}`);
  } catch (e) {
    console.warn('Failed to create MediaRecorder with specified options, using defaults', e);
    try {
      // Fallback to default options
      mediaRecorder = new MediaRecorder(stream);
      console.log(`Fallback: Recording with MIME type: ${mediaRecorder.mimeType}`);
    } catch (fallbackError) {
      console.error('Complete failure to create MediaRecorder', fallbackError);
      // Stop all tracks to release the microphone before throwing
      stream.getTracks().forEach(track => track.stop());
      throw new Error('Could not create audio recorder with your browser');
    }
  }
  
  const audioChunks: BlobPart[] = [];
  
  // Add data to chunks when available
  mediaRecorder.addEventListener('dataavailable', (event) => {
    if (event.data && event.data.size > 0) {
      audioChunks.push(event.data);
      console.log(`Audio chunk received: ${event.data.size} bytes`);
    }
  });
  
  // Start recording and immediately request first data chunk
  mediaRecorder.start(100); // Use 100ms timeslice to get frequent chunks
  console.log('MediaRecorder started');
  
  // Define the stop method that will return a Promise with the audio URL
  const stop = () => {
    return new Promise<{ audioUrl: string, blob: Blob }>((resolve) => {
      mediaRecorder.addEventListener('stop', () => {
        console.log(`Recording stopped, collected ${audioChunks.length} chunks`);
        
        // Handle empty recording with a minimal audio placeholder
        if (audioChunks.length === 0) {
          console.warn('No audio data captured during recording');
          // Create a minimal audio blob (1kb of silence) for consistent behavior
          const silence = new Uint8Array(1024).fill(0);
          const silenceBlob = new Blob([silence], { type: mediaRecorder.mimeType || 'audio/webm' });
          const silenceUrl = URL.createObjectURL(silenceBlob);
          
          // Release microphone
          stream.getTracks().forEach(track => track.stop());
          
          resolve({ audioUrl: silenceUrl, blob: silenceBlob });
          return;
        }
        
        // Create audio blob and get its URL
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        console.log(`Audio blob created: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
        
        // Release microphone
        stream.getTracks().forEach(track => track.stop());
        
        resolve({ audioUrl, blob: audioBlob });
      });
      
      // Ensure we finish getting data before stopping
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.requestData();
        
        // Small delay to make sure data is actually captured
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            console.log('MediaRecorder explicitly stopped');
          }
        }, 200);
      } else {
        console.warn(`Cannot stop recorder, current state: ${mediaRecorder.state}`);
        // If we're not recording, stop anyway
        mediaRecorder.stop();
      }
    });
  };
  
  const pause = () => {
    if (mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      return true;
    }
    return false;
  };
  
  const resume = () => {
    if (mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      return true;
    }
    return false;
  };
  
  // Return an object with methods to control the recorder
  return {
    start: () => {
      if (mediaRecorder.state !== 'recording') {
        mediaRecorder.start(100);
        console.log('MediaRecorder started');
      }
    },
    stop,
    pause,
    resume,
    stream,
    getState: () => mediaRecorder.state
  };
};
