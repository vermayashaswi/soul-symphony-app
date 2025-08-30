import { supabase } from '@/integrations/supabase/client';

/**
 * Mobile Chat Debug Utilities
 * Specialized debugging tools for mobile chat interface issues
 */

interface ChatDebugInfo {
  threadId: string;
  correlationId?: string;
  timestamp: number;
}

interface CompletionCheckResult {
  isCompleted: boolean;
  messagesFound: number;
  latestMessage?: {
    id: string;
    content: string;
    isProcessing: boolean;
    createdAt: string;
  };
  correlationMatches: number;
  debugInfo: string[];
}

/**
 * Enhanced completion check with detailed debugging information
 */
export const debugCompletionCheck = async (
  threadId: string, 
  userId: string, 
  correlationId?: string
): Promise<CompletionCheckResult> => {
  const debugInfo: string[] = [];
  let messagesFound = 0;
  let latestMessage: any = null;
  let correlationMatches = 0;

  try {
    debugInfo.push(`Starting completion check for thread: ${threadId}`);
    debugInfo.push(`User ID: ${userId}`);
    debugInfo.push(`Correlation ID: ${correlationId || 'None'}`);

    // Check correlation-based messages first
    if (correlationId) {
      const { data: correlatedMessages, error: correlatedError } = await supabase
        .from('chat_messages')
        .select('id, created_at, sender, content, is_processing, request_correlation_id')
        .eq('thread_id', threadId)
        .eq('request_correlation_id', correlationId)
        .order('created_at', { ascending: false });

      if (correlatedError) {
        debugInfo.push(`Correlation query error: ${correlatedError.message}`);
      } else {
        correlationMatches = correlatedMessages?.length || 0;
        debugInfo.push(`Found ${correlationMatches} messages with correlation ID`);
        
        const assistantMessage = correlatedMessages?.find(msg => msg.sender === 'assistant');
        if (assistantMessage) {
          debugInfo.push(`Assistant message found: ${assistantMessage.id}`);
          debugInfo.push(`Content length: ${assistantMessage.content?.length || 0}`);
          debugInfo.push(`Is processing: ${assistantMessage.is_processing}`);
          debugInfo.push(`Content preview: ${assistantMessage.content?.substring(0, 100)}...`);
        }
      }
    }

    // Check recent messages
    const recentTime = new Date(Date.now() - 300000).toISOString(); // 5 minutes
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('id, created_at, sender, content, is_processing, request_correlation_id')
      .eq('thread_id', threadId)
      .gte('created_at', recentTime)
      .eq('sender', 'assistant')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      debugInfo.push(`Recent messages query error: ${error.message}`);
    } else {
      messagesFound = messages?.length || 0;
      debugInfo.push(`Found ${messagesFound} recent assistant messages`);
      
      if (messages && messages.length > 0) {
        latestMessage = messages[0];
        debugInfo.push(`Latest message ID: ${latestMessage.id}`);
        debugInfo.push(`Latest message created: ${latestMessage.created_at}`);
        debugInfo.push(`Latest message processing: ${latestMessage.is_processing}`);
        debugInfo.push(`Latest message correlation: ${latestMessage.request_correlation_id}`);
        debugInfo.push(`Latest content preview: ${latestMessage.content?.substring(0, 100)}...`);
      }
    }

    // Determine completion status
    let isCompleted = false;
    if (correlationId && correlationMatches > 0) {
      // Use correlation-based completion
      const assistantMessage = (await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .eq('request_correlation_id', correlationId)
        .eq('sender', 'assistant')
        .single()).data;
      
      if (assistantMessage) {
        isCompleted = !assistantMessage.is_processing && 
                     assistantMessage.content?.trim().length > 20 &&
                     !assistantMessage.content.toLowerCase().includes('processing');
      }
    } else if (latestMessage) {
      // Use recent message completion
      isCompleted = !latestMessage.is_processing &&
                   latestMessage.content?.trim().length > 20 &&
                   !latestMessage.content.toLowerCase().includes('processing');
    }

    debugInfo.push(`Final completion status: ${isCompleted}`);

    return {
      isCompleted,
      messagesFound,
      latestMessage,
      correlationMatches,
      debugInfo
    };

  } catch (error) {
    debugInfo.push(`Exception in completion check: ${error}`);
    return {
      isCompleted: false,
      messagesFound: 0,
      correlationMatches: 0,
      debugInfo
    };
  }
};

/**
 * Mobile-specific state diagnostics
 */
export const diagnoseMobileState = (threadId: string): {
  platform: string;
  localStorage: Record<string, any>;
  sessionStorage: Record<string, any>;
  visibilityState: string;
  windowFocused: boolean;
  connections: number;
  userAgent: string;
} => {
  return {
    platform: navigator.platform,
    localStorage: {
      lastActiveThread: localStorage.getItem('lastActiveChatThreadId'),
      streamingState: localStorage.getItem(`chat_streaming_state_${threadId}`),
    },
    sessionStorage: {
      keys: Object.keys(sessionStorage),
      length: sessionStorage.length
    },
    visibilityState: document.visibilityState,
    windowFocused: document.hasFocus(),
    connections: (navigator as any).connection?.effectiveType || 'unknown',
    userAgent: navigator.userAgent
  };
};

/**
 * Force mobile browser refresh utilities
 */
export const forceMobileBrowserRefresh = () => {
  // Multiple refresh strategies for different mobile browsers
  
  // Strategy 1: Viewport manipulation
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    const originalContent = viewport.getAttribute('content');
    viewport.setAttribute('content', originalContent + ', user-scalable=no');
    setTimeout(() => {
      viewport.setAttribute('content', originalContent || '');
    }, 100);
  }
  
  // Strategy 2: Force layout recalculation
  const body = document.body;
  const originalDisplay = body.style.display;
  body.style.display = 'none';
  body.offsetHeight; // Trigger reflow
  body.style.display = originalDisplay;
  
  // Strategy 3: Window events
  window.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new Event('orientationchange'));
  
  // Strategy 4: Scroll event
  window.scrollTo(0, 0);
  
  console.log('[MobileChatDebug] Forced mobile browser refresh applied');
};

/**
 * Export debugging information for support
 */
export const exportMobileChatDebugInfo = async (threadId: string, userId: string, correlationId?: string) => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    threadId,
    userId,
    correlationId,
    platform: diagnoseMobileState(threadId),
    completionCheck: await debugCompletionCheck(threadId, userId, correlationId),
    console: {
      // Get recent console logs if available
      logs: (window as any).__debugLogs || []
    }
  };
  
  console.log('[MobileChatDebug] Debug info exported:', debugInfo);
  
  // Copy to clipboard if possible
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
      console.log('[MobileChatDebug] Debug info copied to clipboard');
    } catch (e) {
      console.warn('[MobileChatDebug] Failed to copy to clipboard:', e);
    }
  }
  
  return debugInfo;
};