// Enhanced chat state storage with background handling

export interface ChatStreamingState {
  isStreaming: boolean;
  streamingMessages: any[];
  showDynamicMessages?: boolean;
  lastUserInput?: string;
  requestStartTime?: number;
  requestCorrelationId?: string;
  idempotencyKey?: string;
  lastActivity?: number;
  dynamicMessageIndex?: number;
  lastRotationTime?: number;
  retryCount?: number;
  queryCategory?: string;
  abortController?: any; // Will be null when saved/loaded
  pausedDueToBackground?: boolean;
  currentUserMessage?: string;
  savedAt?: number;
  showBackendAnimation?: boolean;
  navigationSafe?: boolean;
  dynamicMessages?: any[];
  currentMessageIndex?: number;
  lastMessageFingerprint?: string | null;
  useThreeDotFallback?: boolean;
  expectedProcessingTime?: number;
  processingStartTime?: number;
  activeRequestId?: string;
  // Additional state for comprehensive restoration
  translatedDynamicMessages?: any[];
  isRetrying?: boolean;
  retryAttempts?: number;
  lastFailedMessage?: any;
  isAppBackgrounded?: boolean;
  isPageHidden?: boolean;
  wasBackgroundProcessing?: boolean;
}

const CHAT_STATE_PREFIX = 'chat_streaming_state_';
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes (increased for stuck state detection)

export const saveChatStreamingState = (threadId: string, state: ChatStreamingState): void => {
  try {
    const stateWithTimestamp = {
      ...state,
      savedAt: Date.now()
    };
    localStorage.setItem(`${CHAT_STATE_PREFIX}${threadId}`, JSON.stringify(stateWithTimestamp));
  } catch (error) {
    console.warn('Failed to save chat streaming state:', error);
  }
};

export const getChatStreamingState = (threadId: string): ChatStreamingState | null => {
  try {
    const stored = localStorage.getItem(`${CHAT_STATE_PREFIX}${threadId}`);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    
    // Check if state is expired
    if (parsed.savedAt && (Date.now() - parsed.savedAt) > STATE_EXPIRY_MS) {
      clearChatStreamingState(threadId);
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.warn('Failed to retrieve chat streaming state:', error);
    return null;
  }
};

export const clearChatStreamingState = (threadId: string): void => {
  try {
    localStorage.removeItem(`${CHAT_STATE_PREFIX}${threadId}`);
  } catch (error) {
    console.warn('Failed to clear chat streaming state:', error);
  }
};

export const clearAllChatStreamingStates = (): void => {
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(CHAT_STATE_PREFIX));
    keys.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Failed to clear all chat streaming states:', error);
  }
};

// Force clear stuck states for a specific user
export const forceClearStuckStates = (userId?: string): number => {
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(CHAT_STATE_PREFIX));
    let clearedCount = 0;
    
    keys.forEach(key => {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          const now = Date.now();
          const stateAge = now - (parsed.savedAt || 0);
          const processingAge = parsed.requestStartTime ? now - parsed.requestStartTime : 0;
          
          // Clear if state is stuck (processing for >10 minutes or aged >10 minutes)
          if (
            (parsed.isStreaming || parsed.showDynamicMessages) && 
            (stateAge > 10 * 60 * 1000 || processingAge > 10 * 60 * 1000)
          ) {
            localStorage.removeItem(key);
            clearedCount++;
            console.log(`Cleared stuck state: ${key}, age: ${stateAge}ms, processing: ${processingAge}ms`);
          }
        }
      } catch (parseError) {
        // Invalid JSON, remove it
        localStorage.removeItem(key);
        clearedCount++;
      }
    });
    
    return clearedCount;
  } catch (error) {
    console.warn('Failed to force clear stuck states:', error);
    return 0;
  }
};

// Auto-cleanup expired states
export const cleanupExpiredChatStates = (): void => {
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(CHAT_STATE_PREFIX));
    const now = Date.now();
    
    keys.forEach(key => {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.savedAt && (now - parsed.savedAt) > STATE_EXPIRY_MS) {
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        // Invalid JSON, remove it
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Failed to cleanup expired chat states:', error);
  }
};

// Run cleanup on module load
cleanupExpiredChatStates();