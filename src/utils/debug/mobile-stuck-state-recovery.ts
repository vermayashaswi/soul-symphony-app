import { supabase } from '@/integrations/supabase/client';

/**
 * Enhanced mobile stuck state recovery utilities
 * Specifically designed to handle persistent UI streaming indicators on mobile browsers
 */

export interface StuckStateDetectionResult {
  isStuck: boolean;
  indicators: string[];
  threadId: string;
  recommendedActions: string[];
}

/**
 * Detects if the mobile chat interface is stuck in a streaming state
 */
export const detectStuckStreamingState = (threadId: string): StuckStateDetectionResult => {
  const indicators: string[] = [];
  const recommendedActions: string[] = [];
  
  // Check for persistent streaming indicators in DOM
  const streamingElements = document.querySelectorAll('[data-streaming="true"]');
  if (streamingElements.length > 0) {
    indicators.push(`${streamingElements.length} streaming indicators found in DOM`);
    recommendedActions.push('Clear DOM streaming indicators');
  }
  
  // Check for streaming avatars
  const streamingAvatars = document.querySelectorAll('[data-chat-avatar-streaming]');
  if (streamingAvatars.length > 0) {
    indicators.push(`${streamingAvatars.length} streaming avatar indicators found`);
    recommendedActions.push('Clear avatar streaming states');
  }
  
  // Check localStorage for stuck states
  const savedState = localStorage.getItem(`chatStreamingState_${threadId}`);
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState);
      if (parsed.isStreaming || parsed.showBackendAnimation) {
        indicators.push('Persistent streaming state in localStorage');
        recommendedActions.push('Clear localStorage streaming state');
      }
    } catch (e) {
      indicators.push('Corrupted streaming state in localStorage');
      recommendedActions.push('Clear corrupted localStorage data');
    }
  }
  
  // Check for stale dynamic messages
  const dynamicMessages = document.querySelectorAll('[data-dynamic-message]');
  if (dynamicMessages.length > 0) {
    indicators.push(`${dynamicMessages.length} stale dynamic messages found`);
    recommendedActions.push('Clear dynamic message indicators');
  }
  
  const isStuck = indicators.length > 0;
  
  if (isStuck) {
    recommendedActions.push('Force viewport refresh', 'Trigger completion events');
  }
  
  return {
    isStuck,
    indicators,
    threadId,
    recommendedActions
  };
};

/**
 * Aggressively clears all stuck streaming state indicators
 */
export const forceRecoverFromStuckState = async (threadId: string): Promise<boolean> => {
  console.log('[MobileStuckStateRecovery] Starting aggressive stuck state recovery for thread:', threadId);
  
  try {
    // 1. Clear all DOM streaming indicators
    const streamingElements = document.querySelectorAll('[data-streaming="true"]');
    streamingElements.forEach(element => {
      element.setAttribute('data-streaming', 'false');
      console.log('[MobileStuckStateRecovery] Cleared streaming indicator:', element);
    });
    
    // 2. Clear streaming avatar states
    const streamingAvatars = document.querySelectorAll('[data-chat-avatar-streaming]');
    streamingAvatars.forEach(element => {
      element.removeAttribute('data-chat-avatar-streaming');
      console.log('[MobileStuckStateRecovery] Cleared avatar streaming state');
    });
    
    // 3. Clear localStorage streaming state
    localStorage.removeItem(`chatStreamingState_${threadId}`);
    console.log('[MobileStuckStateRecovery] Cleared localStorage streaming state');
    
    // 4. Clear dynamic message indicators
    const dynamicMessages = document.querySelectorAll('[data-dynamic-message]');
    dynamicMessages.forEach(element => {
      element.remove();
      console.log('[MobileStuckStateRecovery] Removed dynamic message indicator');
    });
    
    // 5. Force completion events
    window.dispatchEvent(new CustomEvent('chatCompletionDetected', {
      detail: { 
        threadId, 
        correlationId: `recovery-${Date.now()}`,
        restoredFromBackground: false,
        source: 'stuck_state_recovery'
      }
    }));
    
    window.dispatchEvent(new CustomEvent('chatStateUpdated', {
      detail: { 
        threadId, 
        completed: true, 
        source: 'stuck_state_recovery' 
      }
    }));
    
    // 6. Mobile browser specific viewport refresh
    const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent.toLowerCase());
    if (isMobile) {
      // Force viewport refresh
      window.dispatchEvent(new Event('resize'));
      
      // Force scroll refresh
      const chatContainer = document.querySelector('[data-chat-messages-container]');
      if (chatContainer) {
        const currentScroll = chatContainer.scrollTop;
        chatContainer.scrollTop = currentScroll + 1;
        setTimeout(() => {
          chatContainer.scrollTop = currentScroll;
        }, 50);
      }
      
      // Force repaint by manipulating viewport meta tag
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        const content = viewport.getAttribute('content');
        viewport.setAttribute('content', content + ', user-scalable=no');
        setTimeout(() => {
          viewport.setAttribute('content', content || '');
        }, 100);
      }
    }
    
    console.log('[MobileStuckStateRecovery] Successfully completed stuck state recovery');
    return true;
    
  } catch (error) {
    console.error('[MobileStuckStateRecovery] Failed to recover from stuck state:', error);
    return false;
  }
};

/**
 * Validates that recent messages in database match UI state
 */
export const validateMessageStateConsistency = async (threadId: string): Promise<{
  isConsistent: boolean;
  issues: string[];
  lastAssistantMessage?: any;
}> => {
  try {
    // Check for recent assistant messages
    const { data: recentMessages, error } = await supabase
      .from('chat_messages')
      .select('id, content, sender, created_at, is_processing')
      .eq('thread_id', threadId)
      .eq('sender', 'assistant')
      .gte('created_at', new Date(Date.now() - 600000).toISOString()) // Last 10 minutes
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (error) {
      return {
        isConsistent: false,
        issues: [`Database query failed: ${error.message}`]
      };
    }
    
    const issues: string[] = [];
    let lastAssistantMessage = null;
    
    if (recentMessages && recentMessages.length > 0) {
      lastAssistantMessage = recentMessages[0];
      
      // Check if there's a completed message but UI still shows streaming
      if (!lastAssistantMessage.is_processing) {
        const streamingElements = document.querySelectorAll('[data-streaming="true"]');
        const streamingAvatars = document.querySelectorAll('[data-chat-avatar-streaming]');
        
        if (streamingElements.length > 0 || streamingAvatars.length > 0) {
          issues.push('Completed message in database but UI still shows streaming indicators');
        }
      }
      
      // Check for messages stuck in processing state
      const processingMessages = recentMessages.filter(m => m.is_processing);
      if (processingMessages.length > 0) {
        issues.push(`${processingMessages.length} messages stuck in processing state`);
      }
    }
    
    return {
      isConsistent: issues.length === 0,
      issues,
      lastAssistantMessage
    };
    
  } catch (error) {
    return {
      isConsistent: false,
      issues: [`Validation failed: ${error}`]
    };
  }
};

/**
 * Comprehensive mobile chat state diagnostic
 */
export const runMobileChatDiagnostic = async (threadId: string) => {
  console.log('[MobileChatDiagnostic] Running comprehensive diagnostic for thread:', threadId);
  
  const stuckStateResult = detectStuckStreamingState(threadId);
  const consistencyResult = await validateMessageStateConsistency(threadId);
  
  const diagnostic = {
    threadId,
    timestamp: new Date().toISOString(),
    stuckState: stuckStateResult,
    consistency: consistencyResult,
    platform: {
      userAgent: navigator.userAgent,
      isMobile: /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent.toLowerCase()),
      isOnline: navigator.onLine,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    }
  };
  
  console.log('[MobileChatDiagnostic] Diagnostic results:', diagnostic);
  
  // If stuck state detected, offer automatic recovery
  if (stuckStateResult.isStuck) {
    console.log('[MobileChatDiagnostic] Stuck state detected, attempting automatic recovery');
    const recoverySuccess = await forceRecoverFromStuckState(threadId);
    
    return {
      ...diagnostic,
      autoRecovery: {
        attempted: true,
        success: recoverySuccess
      }
    };
  }
  
  return diagnostic;
};