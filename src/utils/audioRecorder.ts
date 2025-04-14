
/**
 * Audio recording utility for voice messages
 */
export const recordAudio = async () => {
  // Check if browser supports audio recording
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Audio recording not supported in this browser');
  }
  
  // Request microphone access
  const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    } 
  });
  
  // Set up the MediaRecorder with improved options to prevent short recordings
  const options = {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 128000 // Higher quality audio
  };
  
  // Try to use the preferred MIME type, fall back to browser defaults if not supported
  let mediaRecorder;
  try {
    mediaRecorder = new MediaRecorder(stream, options);
  } catch (e) {
    console.warn('Preferred audio format not supported, using browser default', e);
    mediaRecorder = new MediaRecorder(stream);
  }
  
  const audioChunks: BlobPart[] = [];
  
  // Start recording
  mediaRecorder.start();
  
  // Add data to chunks when available
  mediaRecorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  });
  
  // Define the stop method that will return a Promise with the audio URL
  const stop = () => {
    return new Promise<{ audioUrl: string, blob: Blob }>((resolve) => {
      mediaRecorder.addEventListener('stop', () => {
        // Ensure we have enough data before creating blob
        if (audioChunks.length === 0) {
          console.warn('No audio chunks collected, creating minimal audio');
          // Create a minimal audio blob to prevent errors
          const silence = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
          audioChunks.push(new Blob([silence], { type: 'audio/webm;codecs=opus' }));
        }
        
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
        
        resolve({ audioUrl, blob: audioBlob });
      });
      
      // Request data before stopping to ensure we get something
      if (mediaRecorder.state === 'recording') {
        try {
          mediaRecorder.requestData();
          setTimeout(() => mediaRecorder.stop(), 100);
        } catch (e) {
          console.warn('Error requesting data before stop', e);
          mediaRecorder.stop();
        }
      } else {
        mediaRecorder.stop();
      }
    });
  };
  
  // Return an object with methods to control the recorder
  return {
    start: () => {
      if (mediaRecorder.state !== 'recording') {
        mediaRecorder.start();
      }
    },
    stop,
    stream
  };
};
