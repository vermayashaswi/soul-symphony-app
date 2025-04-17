
/**
 * Audio recording utility for voice messages
 */
export const recordAudio = async () => {
  // Check if browser supports audio recording
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Audio recording not supported in this browser');
  }
  
  // Request microphone access with specific constraints for better compatibility
  const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,     // Mono for better compatibility
      sampleRate: 44100,   // Standard sample rate for better compatibility
      sampleSize: 16       // Standard bit depth for better compatibility
    } 
  });
  
  // Set up the MediaRecorder with specific options for better compatibility
  const options = {
    mimeType: 'audio/wav',  // WAV format for better compatibility with OpenAI
    audioBitsPerSecond: 128000
  };
  
  // Try to use the preferred MIME type, fallback to browser default if not supported
  const mediaRecorder = MediaRecorder.isTypeSupported(options.mimeType)
    ? new MediaRecorder(stream, options)
    : new MediaRecorder(stream);
  
  const audioChunks: BlobPart[] = [];
  let startTime: number | null = null;
  let recordingDuration = 0;
  
  // Start recording and capture start time
  mediaRecorder.start();
  startTime = Date.now();
  console.log('[audioRecorder] Recording started');
  
  // Add data to chunks when available
  mediaRecorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
      console.log(`[audioRecorder] Received chunk: ${event.data.size} bytes`);
    }
  });
  
  // Define the stop method that will return a Promise with the audio URL
  const stop = () => {
    return new Promise<{ audioUrl: string, blob: Blob, duration: number }>((resolve, reject) => {
      try {
        console.log('[audioRecorder] Stopping recording...');
        
        // Calculate duration before stopping
        if (startTime) {
          recordingDuration = (Date.now() - startTime) / 1000; // in seconds
          console.log(`[audioRecorder] Recording duration: ${recordingDuration}s`);
        }
        
        // Handle stop event
        mediaRecorder.addEventListener('stop', () => {
          try {
            if (audioChunks.length === 0) {
              console.error('[audioRecorder] No audio data recorded');
              reject(new Error('No audio data recorded'));
              return;
            }
            
            // Create blob with correct MIME type - always use WAV for better compatibility
            const mimeType = 'audio/wav';
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            
            if (audioBlob.size < 100) {
              console.error('[audioRecorder] Recording too short');
              reject(new Error('Recording too short'));
              return;
            }
            
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // Stop all tracks to release the microphone
            stream.getTracks().forEach(track => track.stop());
            
            // Create a new blob with duration property using Blob constructor
            const finalBlob = new Blob([audioBlob], { type: mimeType });
            
            try {
              // Set duration on the blob object using explicit property definition
              Object.defineProperty(finalBlob, 'duration', {
                value: recordingDuration,
                writable: false,
                enumerable: true,
                configurable: false
              });
              console.log(`[audioRecorder] Successfully added duration property: ${recordingDuration}s`);
            } catch (err) {
              console.warn('[audioRecorder] Could not add duration property:', err);
            }
            
            console.log(`[audioRecorder] Stopped recording. Duration: ${recordingDuration}s, Size: ${finalBlob.size} bytes, Type: ${finalBlob.type}`);
            
            resolve({ 
              audioUrl, 
              blob: finalBlob, 
              duration: recordingDuration 
            });
          } catch (error) {
            console.error('[audioRecorder] Error in stop handler:', error);
            reject(error);
          }
        });
        
        // Error handling for MediaRecorder
        mediaRecorder.addEventListener('error', (event) => {
          console.error('[audioRecorder] MediaRecorder error:', event);
          reject(new Error('MediaRecorder error'));
        });
        
        // Actually stop the recorder
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        } else {
          console.warn('[audioRecorder] Attempted to stop an inactive recorder');
          reject(new Error('Recorder already stopped'));
        }
      } catch (error) {
        console.error('[audioRecorder] Error stopping recorder:', error);
        reject(error);
      }
    });
  };
  
  // Return an object with methods to control the recorder
  return {
    start: () => {
      if (mediaRecorder.state === 'inactive') {
        mediaRecorder.start();
        startTime = Date.now();
        console.log('[audioRecorder] Recording restarted');
      }
    },
    stop,
    stream,
    getState: () => mediaRecorder.state
  };
};
