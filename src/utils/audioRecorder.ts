
/**
 * Audio recording utility for voice messages
 */
export const recordAudio = async () => {
  // Check if browser supports audio recording
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Audio recording not supported in this browser');
  }
  
  // Request microphone access
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  
  // Set up the MediaRecorder
  const mediaRecorder = new MediaRecorder(stream);
  const audioChunks: BlobPart[] = [];
  
  // Start recording
  mediaRecorder.start();
  
  // Add data to chunks when available
  mediaRecorder.addEventListener('dataavailable', (event) => {
    audioChunks.push(event.data);
  });
  
  // Define the stop method that will return a Promise with the audio URL
  const stop = () => {
    return new Promise<{ audioUrl: string, blob: Blob }>((resolve) => {
      mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
        
        resolve({ audioUrl, blob: audioBlob });
      });
      
      mediaRecorder.stop();
    });
  };
  
  // Return an object with methods to control the recorder
  return {
    start: () => mediaRecorder.start(),
    stop,
    stream
  };
};
