import { useEffect, useCallback } from 'react';
import { usePlatformDetection } from '@/hooks/use-platform-detection';

interface MobileChatEnhancementsProps {
  threadId: string | null;
  onCompletionDetected?: (data: { threadId: string; correlationId?: string }) => void;
  onStateUpdated?: (data: { threadId: string; completed: boolean; source?: string }) => void;
}

/**
 * Enhanced mobile chat functionality to handle stuck states and completion detection
 * Specifically designed to address Android mobile browser issues with chat interface
 */
export const useMobileChatEnhancements = ({ 
  threadId, 
  onCompletionDetected, 
  onStateUpdated 
}: MobileChatEnhancementsProps) => {
  const { platform, isReady } = usePlatformDetection();

  // Enhanced event listener for chat completion detection
  const handleChatCompletion = useCallback((event: CustomEvent) => {
    const { threadId: eventThreadId, correlationId, restoredFromBackground } = event.detail;
    
    console.log('[MobileChatEnhancements] Chat completion detected:', {
      eventThreadId,
      currentThreadId: threadId,
      correlationId,
      restoredFromBackground
    });
    
    // Only handle events for the current thread
    if (eventThreadId === threadId && onCompletionDetected) {
      onCompletionDetected({ threadId: eventThreadId, correlationId });
      
      // Force a small delay to ensure UI updates properly on mobile
      if (platform === 'android') {
        setTimeout(() => {
          console.log('[MobileChatEnhancements] Android mobile browser: Forcing UI refresh');
          // Trigger a window resize event to force mobile browser redraw
          window.dispatchEvent(new Event('resize'));
        }, 100);
      }
    }
  }, [threadId, onCompletionDetected, platform]);

  // Enhanced event listener for chat state updates
  const handleStateUpdate = useCallback((event: CustomEvent) => {
    const { threadId: eventThreadId, completed, source } = event.detail;
    
    console.log('[MobileChatEnhancements] Chat state updated:', {
      eventThreadId,
      currentThreadId: threadId,
      completed,
      source
    });
    
    // Only handle events for the current thread
    if (eventThreadId === threadId && onStateUpdated) {
      onStateUpdated({ threadId: eventThreadId, completed, source });
      
      // Mobile browser specific handling
      if ((platform === 'android' || platform === 'ios') && completed) {
        setTimeout(() => {
          console.log('[MobileChatEnhancements] Mobile browser: Ensuring scroll position');
          // Ensure proper scroll behavior after completion
          const chatContainer = document.querySelector('[data-chat-messages-container]');
          if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
          }
        }, 200);
      }
    }
  }, [threadId, onStateUpdated, platform]);

  // Manual refresh trigger for stuck states
  const triggerManualRefresh = useCallback(() => {
    console.log('[MobileChatEnhancements] Manual refresh triggered for thread:', threadId);
    
    if (threadId) {
      // Emit a custom event to force state check
      window.dispatchEvent(new CustomEvent('forceChatRefresh', {
        detail: { threadId, source: 'manual_trigger' }
      }));
      
      // Mobile browser specific refresh actions
      if (platform === 'android') {
        // Force viewport refresh
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          const content = viewport.getAttribute('content');
          viewport.setAttribute('content', content + ', user-scalable=no');
          setTimeout(() => {
            viewport.setAttribute('content', content || '');
          }, 100);
        }
      }
    }
  }, [threadId, platform]);

  // Check if manual refresh is available (for UI controls)
  const canManualRefresh = useCallback(() => {
    return platform === 'android' && threadId !== null;
  }, [platform, threadId]);

  // Setup event listeners
  useEffect(() => {
    if (!isReady || !threadId) return;

    // Add enhanced event listeners
    window.addEventListener('chatCompletionDetected', handleChatCompletion as EventListener);
    window.addEventListener('chatStateUpdated', handleStateUpdate as EventListener);
    
    // Mobile browser specific enhancements
    if (platform === 'android' || platform === 'ios') {
      // Add viewport change listener for mobile browsers
      const handleViewportChange = () => {
        console.log('[MobileChatEnhancements] Mobile viewport changed, checking chat state');
        // Small delay to ensure proper handling
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('mobileViewportChanged', {
            detail: { threadId, platform }
          }));
        }, 150);
      };

      // Listen for orientation changes which can affect chat state
      window.addEventListener('orientationchange', handleViewportChange);
      
      // Listen for resize events which mobile browsers fire inconsistently
      let resizeTimeout: NodeJS.Timeout;
      const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleViewportChange, 300);
      };
      
      window.addEventListener('resize', handleResize);
      
      // Cleanup function
      return () => {
        window.removeEventListener('chatCompletionDetected', handleChatCompletion as EventListener);
        window.removeEventListener('chatStateUpdated', handleStateUpdate as EventListener);
        window.removeEventListener('orientationchange', handleViewportChange);
        window.removeEventListener('resize', handleResize);
        clearTimeout(resizeTimeout);
      };
    }

    // Cleanup for non-mobile
    return () => {
      window.removeEventListener('chatCompletionDetected', handleChatCompletion as EventListener);
      window.removeEventListener('chatStateUpdated', handleStateUpdate as EventListener);
    };
  }, [isReady, threadId, platform, handleChatCompletion, handleStateUpdate]);

  return {
    triggerManualRefresh,
    canManualRefresh,
    isMobile: platform === 'android' || platform === 'ios',
    platform
  };
};