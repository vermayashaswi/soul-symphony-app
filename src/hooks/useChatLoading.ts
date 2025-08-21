import { useState } from 'react';

/**
 * Simple hook for managing UI-only loading states in chat
 * Replaces complex is_processing database field with local state
 */
export const useChatLoading = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const startLoading = (message = 'Processing...') => {
    setIsLoading(true);
    setLoadingMessage(message);
  };

  const stopLoading = () => {
    setIsLoading(false);
    setLoadingMessage('');
  };

  return {
    isLoading,
    loadingMessage,
    startLoading,
    stopLoading
  };
};