// Enhanced idempotency-based state reconciliation for chat threads
import { supabase } from '@/integrations/supabase/client';
import { MessageTrackingInfo, ThreadStreamingState } from './useStreamingChatV2';

// Reconcile local state with database using idempotency keys
export const reconcileStateWithDatabase = async (
  threadId: string,
  userId: string,
  state: ThreadStreamingState
): Promise<{
  hasOrphanedStates: boolean;
  completedKeys: string[];
  failedKeys: string[];
  recommendations: string[];
}> => {
  console.log(`[useIdempotencyStateManager] Starting state reconciliation for thread: ${threadId}`);
  
  try {
    const completedKeys: string[] = [];
    const failedKeys: string[] = [];
    const recommendations: string[] = [];
    let hasOrphanedStates = false;

    // Check all pending idempotency keys against database
    for (const idempotencyKey of state.pendingIdempotencyKeys) {
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id, sender, content, is_processing, created_at, idempotency_key')
        .eq('thread_id', threadId)
        .eq('idempotency_key', idempotencyKey)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`[useIdempotencyStateManager] Error checking idempotency key ${idempotencyKey}:`, error);
        continue;
      }

      if (!messages || messages.length === 0) {
        // Orphaned state - pending key with no database record
        hasOrphanedStates = true;
        recommendations.push(`Remove orphaned pending key: ${idempotencyKey}`);
        continue;
      }

      const userMessage = messages.find(msg => msg.sender === 'user');
      if (userMessage) {
        // Check for corresponding assistant response
        const assistantResponses = messages.filter(msg => msg.sender === 'assistant');
        const completedResponse = assistantResponses.find(msg => 
          msg.content && 
          msg.content.trim().length > 20 && 
          !msg.is_processing &&
          !msg.content.toLowerCase().includes('processing')
        );

        if (completedResponse) {
          completedKeys.push(idempotencyKey);
          recommendations.push(`Mark ${idempotencyKey} as completed`);
        } else if (assistantResponses.some(msg => msg.is_processing)) {
          // Still processing, keep as pending
          continue;
        } else {
          // User message exists but no valid response - consider failed
          const messageAge = Date.now() - new Date(userMessage.created_at).getTime();
          if (messageAge > 300000) { // 5 minutes
            failedKeys.push(idempotencyKey);
            recommendations.push(`Mark ${idempotencyKey} as failed (no response after 5 minutes)`);
          }
        }
      }
    }

    // Cross-validate completed keys
    for (const idempotencyKey of state.completedIdempotencyKeys) {
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id, sender, content, is_processing, idempotency_key')
        .eq('thread_id', threadId)
        .eq('idempotency_key', idempotencyKey)
        .eq('sender', 'assistant')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !messages || messages.length === 0) {
        hasOrphanedStates = true;
        recommendations.push(`Revalidate completed key: ${idempotencyKey} (no assistant response found)`);
      }
    }

    console.log(`[useIdempotencyStateManager] Reconciliation complete for thread: ${threadId}`, {
      hasOrphanedStates,
      completedKeys: completedKeys.length,
      failedKeys: failedKeys.length,
      recommendations: recommendations.length
    });

    return {
      hasOrphanedStates,
      completedKeys,
      failedKeys,
      recommendations
    };

  } catch (error) {
    console.error(`[useIdempotencyStateManager] Exception during reconciliation:`, error);
    return {
      hasOrphanedStates: false,
      completedKeys: [],
      failedKeys: [],
      recommendations: [`Reconciliation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
};

// Enhanced message tracking with lifecycle management
export const updateMessageTracking = (
  state: ThreadStreamingState,
  idempotencyKey: string,
  status: 'pending' | 'completed' | 'failed' | 'orphaned',
  correlationId?: string,
  messageId?: string
): ThreadStreamingState => {
  const updatedState = { ...state };
  
  // Update tracking map
  const trackingInfo: MessageTrackingInfo = {
    idempotencyKey,
    correlationId,
    status,
    timestamp: Date.now(),
    retryCount: state.messageTracking.get(idempotencyKey)?.retryCount || 0,
    messageId
  };
  
  updatedState.messageTracking.set(idempotencyKey, trackingInfo);
  
  // Update status sets
  // Clear from all sets first
  updatedState.pendingIdempotencyKeys.delete(idempotencyKey);
  updatedState.completedIdempotencyKeys.delete(idempotencyKey);
  updatedState.failedIdempotencyKeys.delete(idempotencyKey);
  
  // Add to appropriate set
  switch (status) {
    case 'pending':
      updatedState.pendingIdempotencyKeys.add(idempotencyKey);
      break;
    case 'completed':
      updatedState.completedIdempotencyKeys.add(idempotencyKey);
      break;
    case 'failed':
    case 'orphaned':
      updatedState.failedIdempotencyKeys.add(idempotencyKey);
      break;
  }
  
  console.log(`[useIdempotencyStateManager] Updated message tracking for ${idempotencyKey}:`, {
    status,
    correlationId,
    messageId,
    pendingCount: updatedState.pendingIdempotencyKeys.size,
    completedCount: updatedState.completedIdempotencyKeys.size,
    failedCount: updatedState.failedIdempotencyKeys.size
  });
  
  return updatedState;
};

// Deduplication guard for UI state management
export const shouldProcessMessage = (
  state: ThreadStreamingState,
  idempotencyKey: string
): boolean => {
  // Check if already completed
  if (state.completedIdempotencyKeys.has(idempotencyKey)) {
    console.log(`[useIdempotencyStateManager] Blocking duplicate processing for completed key: ${idempotencyKey}`);
    return false;
  }
  
  // Check if currently pending
  if (state.pendingIdempotencyKeys.has(idempotencyKey)) {
    const trackingInfo = state.messageTracking.get(idempotencyKey);
    if (trackingInfo) {
      const timeSinceStart = Date.now() - trackingInfo.timestamp;
      // Allow retry after 30 seconds
      if (timeSinceStart < 30000) {
        console.log(`[useIdempotencyStateManager] Blocking duplicate processing for pending key: ${idempotencyKey}`, {
          timeSinceStart,
          retryCount: trackingInfo.retryCount
        });
        return false;
      }
    }
  }
  
  // Check if failed with recent failure
  if (state.failedIdempotencyKeys.has(idempotencyKey)) {
    const trackingInfo = state.messageTracking.get(idempotencyKey);
    if (trackingInfo) {
      const timeSinceFailure = Date.now() - trackingInfo.timestamp;
      // Allow retry after 2 minutes for failed messages
      if (timeSinceFailure < 120000) {
        console.log(`[useIdempotencyStateManager] Blocking retry for recently failed key: ${idempotencyKey}`, {
          timeSinceFailure,
          retryCount: trackingInfo.retryCount
        });
        return false;
      }
    }
  }
  
  console.log(`[useIdempotencyStateManager] Allowing processing for key: ${idempotencyKey}`);
  return true;
};

// Cross-tab coordination using localStorage events
export const coordinateAcrossTabsForIdempotency = (
  threadId: string,
  idempotencyKey: string,
  action: 'start' | 'complete' | 'fail'
): void => {
  const coordinationData = {
    threadId,
    idempotencyKey,
    action,
    timestamp: Date.now(),
    tabId: `tab_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
  };
  
  localStorage.setItem(`chat_coordination_${threadId}_${idempotencyKey}`, JSON.stringify(coordinationData));
  
  // Dispatch custom event for same-tab coordination
  window.dispatchEvent(new CustomEvent('chatIdempotencyCoordination', {
    detail: coordinationData
  }));
  
  console.log(`[useIdempotencyStateManager] Cross-tab coordination for ${action}:`, coordinationData);
};

// Cleanup expired tracking data
export const cleanupExpiredTracking = (state: ThreadStreamingState): ThreadStreamingState => {
  const updatedState = { ...state };
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [key, tracking] of state.messageTracking.entries()) {
    if (now - tracking.timestamp > maxAge) {
      updatedState.messageTracking.delete(key);
      updatedState.pendingIdempotencyKeys.delete(key);
      updatedState.completedIdempotencyKeys.delete(key);
      updatedState.failedIdempotencyKeys.delete(key);
    }
  }
  
  return updatedState;
};
