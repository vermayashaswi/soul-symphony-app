// Chat state persistence utilities
export interface ChatStreamingState {
  threadId: string;
  isStreaming: boolean;
  streamingMessages: any[];
  currentUserMessage: string;
  showBackendAnimation: boolean;
  dynamicMessages: string[];
  currentMessageIndex: number;
  useThreeDotFallback: boolean;
  queryCategory: string;
  timestamp: number;
  expectedProcessingTime?: number;
  processingStartTime?: number;
}

export interface PersistedChatState {
  [threadId: string]: ChatStreamingState;
}

const CHAT_STATE_KEY = 'soulo_chat_streaming_states';
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export const saveChatStreamingState = (threadId: string, state: Omit<ChatStreamingState, 'threadId' | 'timestamp'>) => {
  try {
    const existingStates = getChatStreamingStates();
    const chatState: ChatStreamingState = {
      ...state,
      threadId,
      timestamp: Date.now()
    };
    
    existingStates[threadId] = chatState;
    localStorage.setItem(CHAT_STATE_KEY, JSON.stringify(existingStates));
    
    console.log('[ChatStateStorage] Saved streaming state for thread:', threadId);
  } catch (error) {
    console.error('[ChatStateStorage] Failed to save streaming state:', error);
  }
};

export const getChatStreamingState = (threadId: string): ChatStreamingState | null => {
  try {
    const states = getChatStreamingStates();
    const state = states[threadId];
    
    if (!state) return null;
    
    // Check if state is expired
    if (Date.now() - state.timestamp > STATE_EXPIRY_MS) {
      clearChatStreamingState(threadId);
      return null;
    }
    
    return state;
  } catch (error) {
    console.error('[ChatStateStorage] Failed to get streaming state:', error);
    return null;
  }
};

export const clearChatStreamingState = (threadId: string) => {
  try {
    const states = getChatStreamingStates();
    delete states[threadId];
    localStorage.setItem(CHAT_STATE_KEY, JSON.stringify(states));
    
    console.log('[ChatStateStorage] Cleared streaming state for thread:', threadId);
  } catch (error) {
    console.error('[ChatStateStorage] Failed to clear streaming state:', error);
  }
};

export const getChatStreamingStates = (): PersistedChatState => {
  try {
    const stored = localStorage.getItem(CHAT_STATE_KEY);
    if (!stored) return {};
    
    const states = JSON.parse(stored) as PersistedChatState;
    
    // Clean up expired states
    const currentTime = Date.now();
    const cleanedStates: PersistedChatState = {};
    
    Object.entries(states).forEach(([threadId, state]) => {
      if (currentTime - state.timestamp <= STATE_EXPIRY_MS) {
        cleanedStates[threadId] = state;
      }
    });
    
    // Save cleaned states back
    if (Object.keys(cleanedStates).length !== Object.keys(states).length) {
      localStorage.setItem(CHAT_STATE_KEY, JSON.stringify(cleanedStates));
    }
    
    return cleanedStates;
  } catch (error) {
    console.error('[ChatStateStorage] Failed to get streaming states:', error);
    return {};
  }
};

export const clearAllExpiredStates = () => {
  try {
    getChatStreamingStates(); // This will automatically clean up expired states
    console.log('[ChatStateStorage] Cleaned up expired streaming states');
  } catch (error) {
    console.error('[ChatStateStorage] Failed to clean up expired states:', error);
  }
};