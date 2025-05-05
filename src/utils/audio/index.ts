
// Re-export from processing-state.ts for backwards compatibility
export {
  createProcessingEntry,
  updateProcessingEntry,
  getProcessingEntry,
  getProcessingEntries,
  removeProcessingEntry,
  clearAllProcessingEntries,
  getProcessingEntriesForUser,
  updateProcessingEntries,
  setHasPreviousEntries,
  getHasPreviousEntries,
  setProcessingLock,
  getProcessingLock,
  setIsEntryBeingProcessed,
  getIsEntryBeingProcessed,
  setProcessingTimeoutId,
  getProcessingTimeoutId,
  resetProcessingState
} from './processing-state';

// Re-export from other audio-related utilities as needed
export { validateAudioBlob } from './blob-utils';
export { verifyUserAuthentication } from './auth-utils';
export { 
  getEntryIdForProcessingId, 
  setEntryIdForProcessingId,
  removeProcessingEntryById,
  processRecording
} from '../audio-processing';
