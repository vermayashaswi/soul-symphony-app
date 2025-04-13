
/**
 * Debug utility for troubleshooting audio processing issues
 */

// Enable this flag to see detailed debugging information in the console
const DEBUG_ENABLED = true;

export function debugAudioProcessing() {
  if (!DEBUG_ENABLED) return;
  
  // Listen for all audio-related debug events
  window.addEventListener('debug:transcription', (event: Event) => {
    const debugEvent = event as CustomEvent;
    console.group(`🎤 Audio Debug [${debugEvent.detail.step}]`);
    console.log('Details:', debugEvent.detail);
    console.groupEnd();
  });
  
  window.addEventListener('debug:audio-processing', (event: Event) => {
    const debugEvent = event as CustomEvent;
    console.group(`🔊 Processing Debug [${debugEvent.detail.step}]`);
    console.log('Details:', debugEvent.detail);
    console.groupEnd();
  });
  
  console.log('🔍 Audio debugging initialized');
}

// Add method to check if audio processing is in progress
export function checkAudioProcessingStatus() {
  const processingEntries = localStorage.getItem('processingEntries');
  const entries = processingEntries ? JSON.parse(processingEntries) : [];
  
  if (entries.length > 0) {
    console.log('🔄 Audio processing in progress:', entries);
    return entries;
  }
  
  console.log('✓ No audio processing in progress');
  return [];
}

// Add method to manually reset processing state if needed
export function resetAudioProcessingState() {
  localStorage.setItem('processingEntries', JSON.stringify([]));
  console.log('🧹 Audio processing state has been reset');
  
  // Dispatch event so UI can update
  window.dispatchEvent(
    new CustomEvent('processingEntriesChanged', {
      detail: { entries: [] }
    })
  );
  
  return true;
}
