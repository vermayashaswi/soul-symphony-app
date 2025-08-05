import { useReducer, useCallback, useRef, useEffect } from 'react';

export interface UIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  references?: any[];
  analysis?: any;
  hasNumericResult?: boolean;
  timestamp: number;
}

interface ChatState {
  messages: UIChatMessage[];
  threadId: string | null;
  isLoading: boolean;
  isProcessing: boolean;
  showSuggestions: boolean;
  initialLoading: boolean;
  showDeleteDialog: boolean;
  sheetOpen: boolean;
  error: string | null;
}

type ChatAction =
  | { type: 'SET_MESSAGES'; payload: UIChatMessage[] }
  | { type: 'ADD_MESSAGE'; payload: UIChatMessage }
  | { type: 'SET_THREAD_ID'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_SHOW_SUGGESTIONS'; payload: boolean }
  | { type: 'SET_INITIAL_LOADING'; payload: boolean }
  | { type: 'SET_SHOW_DELETE_DIALOG'; payload: boolean }
  | { type: 'SET_SHEET_OPEN'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_CHAT' }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<UIChatMessage> } };

const initialState: ChatState = {
  messages: [],
  threadId: null,
  isLoading: false,
  isProcessing: false,
  showSuggestions: true,
  initialLoading: true,
  showDeleteDialog: false,
  sheetOpen: false,
  error: null,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload, error: null };
    
    case 'ADD_MESSAGE':
      return { 
        ...state, 
        messages: [...state.messages, action.payload],
        error: null 
      };
    
    case 'SET_THREAD_ID':
      return { ...state, threadId: action.payload };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };
    
    case 'SET_SHOW_SUGGESTIONS':
      return { ...state, showSuggestions: action.payload };
    
    case 'SET_INITIAL_LOADING':
      return { ...state, initialLoading: action.payload };
    
    case 'SET_SHOW_DELETE_DIALOG':
      return { ...state, showDeleteDialog: action.payload };
    
    case 'SET_SHEET_OPEN':
      return { ...state, sheetOpen: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'RESET_CHAT':
      return {
        ...initialState,
        threadId: state.threadId, // Keep thread ID when resetting
        initialLoading: false
      };
    
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.id 
            ? { ...msg, ...action.payload.updates }
            : msg
        )
      };
    
    default:
      return state;
  }
}

export const useChatState = (initialThreadId?: string | null) => {
  const [state, dispatch] = useReducer(chatReducer, {
    ...initialState,
    threadId: initialThreadId || null
  });

  const loadedThreadRef = useRef<string | null>(null);
  const cleanupFunctions = useRef<Set<() => void>>(new Set());

  // Cleanup function for preventing memory leaks
  const addCleanupFunction = useCallback((cleanup: () => void) => {
    cleanupFunctions.current.add(cleanup);
    return () => {
      cleanupFunctions.current.delete(cleanup);
    };
  }, []);

  // Cleanup all functions on unmount
  useEffect(() => {
    return () => {
      cleanupFunctions.current.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.warn('[useChatState] Error during cleanup:', error);
        }
      });
      cleanupFunctions.current.clear();
    };
  }, []);

  // Action creators
  const actions = {
    setMessages: useCallback((messages: UIChatMessage[]) => {
      dispatch({ type: 'SET_MESSAGES', payload: messages });
    }, []),

    addMessage: useCallback((message: Omit<UIChatMessage, 'id' | 'timestamp'>) => {
      const fullMessage: UIChatMessage = {
        ...message,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      };
      dispatch({ type: 'ADD_MESSAGE', payload: fullMessage });
      return fullMessage;
    }, []),

    setThreadId: useCallback((threadId: string | null) => {
      dispatch({ type: 'SET_THREAD_ID', payload: threadId });
      loadedThreadRef.current = threadId;
    }, []),

    setLoading: useCallback((loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    }, []),

    setProcessing: useCallback((processing: boolean) => {
      dispatch({ type: 'SET_PROCESSING', payload: processing });
    }, []),

    setShowSuggestions: useCallback((show: boolean) => {
      dispatch({ type: 'SET_SHOW_SUGGESTIONS', payload: show });
    }, []),

    setInitialLoading: useCallback((loading: boolean) => {
      dispatch({ type: 'SET_INITIAL_LOADING', payload: loading });
    }, []),

    setShowDeleteDialog: useCallback((show: boolean) => {
      dispatch({ type: 'SET_SHOW_DELETE_DIALOG', payload: show });
    }, []),

    setSheetOpen: useCallback((open: boolean) => {
      dispatch({ type: 'SET_SHEET_OPEN', payload: open });
    }, []),

    setError: useCallback((error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    }, []),

    resetChat: useCallback(() => {
      dispatch({ type: 'RESET_CHAT' });
      loadedThreadRef.current = null;
    }, []),

    updateMessage: useCallback((id: string, updates: Partial<UIChatMessage>) => {
      dispatch({ type: 'UPDATE_MESSAGE', payload: { id, updates } });
    }, [])
  };

  return {
    state,
    actions,
    loadedThreadRef,
    addCleanupFunction
  };
};