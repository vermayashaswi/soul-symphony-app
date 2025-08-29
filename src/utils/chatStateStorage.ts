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
}

const CHAT_STATE_PREFIX = 'chat_streaming_state_';
const STATE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

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