// Minimal chat state storage (kept for potential future use)

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
  abortController?: any;
  currentUserMessage?: string;
  showBackendAnimation?: boolean;
  dynamicMessages?: any[];
  currentMessageIndex?: number;
  lastMessageFingerprint?: string | null;
  useThreeDotFallback?: boolean;
  expectedProcessingTime?: number;
  processingStartTime?: number;
  activeRequestId?: string;
  messageTrackingData?: { [key: string]: any };
  pendingIdempotencyKeys?: string[];
  completedIdempotencyKeys?: string[];
  failedIdempotencyKeys?: string[];
  lastReconciliationCheck?: number;
}

const CHAT_STATE_PREFIX = 'chat_streaming_state_';

// Simplified storage functions (no automatic saving/restoration)
export const saveChatStreamingState = (threadId: string, state: ChatStreamingState): void => {
  // No-op - state persistence disabled
  console.log(`[chatStateStorage] State persistence disabled for thread: ${threadId}`);
};

export const getChatStreamingState = (threadId: string): ChatStreamingState | null => {
  // No-op - state restoration disabled
  return null;
};

export const clearChatStreamingState = (threadId: string): void => {
  try {
    localStorage.removeItem(`${CHAT_STATE_PREFIX}${threadId}`);
    localStorage.removeItem(`${CHAT_STATE_PREFIX}keys_${threadId}`);
    
    // Clear any coordination data
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(`chat_coordination_${threadId}_`)
    );
    keys.forEach(key => localStorage.removeItem(key));
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

export const cleanupExpiredChatStates = (): void => {
  // No-op - no expiry to clean up
};