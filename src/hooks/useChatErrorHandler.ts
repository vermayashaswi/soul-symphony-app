import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface ChatError {
  type: 'rls_violation' | 'empty_journal' | 'network' | 'timeout' | 'general';
  message: string;
  retryable: boolean;
  userAction?: string;
}

export const useChatErrorHandler = () => {
  const { toast } = useToast();

  const parseError = useCallback((error: any): ChatError => {
    const errorMessage = error?.message || error?.toString() || '';
    
    // RLS policy violations
    if (errorMessage.includes('violates row-level security') || 
        errorMessage.includes('authentication required')) {
      return {
        type: 'rls_violation',
        message: 'Authentication issue detected. Please refresh the page and try again.',
        retryable: false,
        userAction: 'refresh_page'
      };
    }
    
    // Empty journal handling
    if (errorMessage.includes('no journal entries') || 
        error?.metadata?.hasJournalEntries === false) {
      return {
        type: 'empty_journal',
        message: 'Create your first journal entry to get personalized insights!',
        retryable: false,
        userAction: 'create_journal'
      };
    }
    
    // Network errors
    if (errorMessage.includes('network') || 
        errorMessage.includes('failed to fetch') ||
        !navigator.onLine) {
      return {
        type: 'network',
        message: 'Network connection issue. Please check your internet and try again.',
        retryable: true
      };
    }
    
    // Timeout errors
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('timed out')) {
      return {
        type: 'timeout',
        message: 'Request timed out. Please try again.',
        retryable: true
      };
    }
    
    // General errors
    return {
      type: 'general',
      message: 'Something went wrong. Please try again.',
      retryable: true
    };
  }, []);

  const handleError = useCallback((error: any, onRetry?: () => void) => {
    const chatError = parseError(error);
    
    console.error('[ChatErrorHandler] Handling error:', {
      type: chatError.type,
      message: chatError.message,
      retryable: chatError.retryable,
      originalError: error
    });
    
    // Show appropriate toast
    toast({
      title: "Chat Error",
      description: chatError.message,
      variant: "destructive"
    });
    
    return chatError;
  }, [parseError, toast]);

  return {
    parseError,
    handleError
  };
};