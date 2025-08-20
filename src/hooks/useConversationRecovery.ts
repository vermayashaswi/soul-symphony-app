import { useState, useCallback, useEffect } from 'react';
import { ChatMessage } from '@/types/chat';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RecoveryState {
  isRecovering: boolean;
  lastRecoveryAttempt: number;
  recoveryAttempts: number;
  failedThreads: Set<string>;
  diagnostics: Map<string, any>;
}

const MAX_RECOVERY_ATTEMPTS = 3;
const RECOVERY_COOLDOWN = 30000; // 30 seconds
const DIAGNOSTIC_RETENTION = 300000; // 5 minutes

export const useConversationRecovery = (userId?: string) => {
  const { toast } = useToast();
  const [state, setState] = useState<RecoveryState>({
    isRecovering: false,
    lastRecoveryAttempt: 0,
    recoveryAttempts: 0,
    failedThreads: new Set(),
    diagnostics: new Map()
  });

  // Log diagnostic information
  const logDiagnostic = useCallback((threadId: string, type: string, data: any) => {
    const timestamp = Date.now();
    const diagnostic = {
      timestamp,
      type,
      threadId,
      data,
      userId
    };

    setState(prev => {
      const newDiagnostics = new Map(prev.diagnostics);
      const key = `${threadId}_${type}_${timestamp}`;
      newDiagnostics.set(key, diagnostic);
      return {
        ...prev,
        diagnostics: newDiagnostics
      };
    });

    console.log(`[ConversationRecovery] Diagnostic logged:`, diagnostic);
  }, [userId]);

  // Detect conversation inconsistencies
  const detectInconsistencies = useCallback(async (
    threadId: string,
    localMessages: ChatMessage[]
  ): Promise<{
    hasInconsistency: boolean;
    issues: string[];
    recommendations: string[];
  }> => {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check database state
      const { data: dbMessages, error } = await supabase
        .from('chat_messages')
        .select('id, created_at, sender, content')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) {
        issues.push('Database query failed');
        recommendations.push('Check database connectivity');
        logDiagnostic(threadId, 'database_error', { error });
        return { hasInconsistency: true, issues, recommendations };
      }

      const dbMessageIds = new Set((dbMessages || []).map(m => m.id));
      const localMessageIds = new Set(localMessages.map(m => m.id));

      // Check for missing messages in local state
      const missingLocal = (dbMessages || []).filter(m => !localMessageIds.has(m.id));
      if (missingLocal.length > 0) {
        issues.push(`${missingLocal.length} messages missing from local state`);
        recommendations.push('Refresh conversation to sync missing messages');
        logDiagnostic(threadId, 'missing_local_messages', { count: missingLocal.length, messages: missingLocal });
      }

      // Check for orphaned local messages
      const orphanedLocal = localMessages.filter(m => !dbMessageIds.has(m.id));
      if (orphanedLocal.length > 0) {
        issues.push(`${orphanedLocal.length} local messages not found in database`);
        recommendations.push('Remove orphaned messages or re-save them');
        logDiagnostic(threadId, 'orphaned_local_messages', { count: orphanedLocal.length, messages: orphanedLocal });
      }

      // Check message ordering
      const localTimestamps = localMessages.map(m => new Date(m.created_at).getTime());
      const sortedTimestamps = [...localTimestamps].sort((a, b) => a - b);
      if (JSON.stringify(localTimestamps) !== JSON.stringify(sortedTimestamps)) {
        issues.push('Message ordering inconsistency detected');
        recommendations.push('Re-sort messages by timestamp');
        logDiagnostic(threadId, 'ordering_issue', { localOrder: localTimestamps, expectedOrder: sortedTimestamps });
      }

      // Check for incomplete conversations (user message without assistant response)
      const incompleteConversations = [];
      for (let i = 0; i < localMessages.length; i++) {
        const message = localMessages[i];
        if (message.sender === 'user') {
          const nextMessage = localMessages[i + 1];
          if (!nextMessage || nextMessage.sender === 'user') {
            incompleteConversations.push(message.id);
          }
        }
      }

      if (incompleteConversations.length > 0) {
        issues.push(`${incompleteConversations.length} incomplete conversations detected`);
        recommendations.push('Check for failed assistant responses');
        logDiagnostic(threadId, 'incomplete_conversations', { messageIds: incompleteConversations });
      }

      return {
        hasInconsistency: issues.length > 0,
        issues,
        recommendations
      };

    } catch (error) {
      issues.push('Failed to analyze conversation consistency');
      recommendations.push('Try again later or contact support');
      logDiagnostic(threadId, 'analysis_error', { error });
      
      return { hasInconsistency: true, issues, recommendations };
    }
  }, [logDiagnostic]);

  // Attempt automatic recovery
  const attemptRecovery = useCallback(async (
    threadId: string,
    localMessages: ChatMessage[]
  ): Promise<{
    success: boolean;
    recoveredMessages: ChatMessage[];
    error?: string;
  }> => {
    const now = Date.now();
    
    // Check cooldown and attempt limits
    if (now - state.lastRecoveryAttempt < RECOVERY_COOLDOWN) {
      return {
        success: false,
        recoveredMessages: [],
        error: 'Recovery in cooldown period'
      };
    }

    if (state.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
      return {
        success: false,
        recoveredMessages: [],
        error: 'Maximum recovery attempts exceeded'
      };
    }

    setState(prev => ({
      ...prev,
      isRecovering: true,
      lastRecoveryAttempt: now,
      recoveryAttempts: prev.recoveryAttempts + 1
    }));

    try {
      console.log(`[ConversationRecovery] Starting recovery for thread ${threadId}`);
      
      // Re-fetch all messages from database
      const { data: dbMessages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Database fetch failed: ${error.message}`);
      }

      const recoveredMessages: ChatMessage[] = (dbMessages || []).map(msg => ({
        ...msg,
        sender: msg.sender as 'user' | 'assistant' | 'error',
        role: msg.role as 'user' | 'assistant' | 'error',
        sub_query_responses: Array.isArray(msg.sub_query_responses) ? msg.sub_query_responses : []
      }));

      logDiagnostic(threadId, 'recovery_success', {
        originalCount: localMessages.length,
        recoveredCount: recoveredMessages.length,
        attempt: state.recoveryAttempts + 1
      });

      setState(prev => ({
        ...prev,
        isRecovering: false,
        recoveryAttempts: 0 // Reset on success
      }));

      console.log(`[ConversationRecovery] Successfully recovered ${recoveredMessages.length} messages`);
      
      toast({
        title: "Conversation Restored",
        description: `Successfully recovered ${recoveredMessages.length} messages`,
        variant: "default"
      });

      return {
        success: true,
        recoveredMessages
      };

    } catch (error) {
      console.error('[ConversationRecovery] Recovery failed:', error);
      
      setState(prev => ({
        ...prev,
        isRecovering: false,
        failedThreads: new Set(prev.failedThreads).add(threadId)
      }));

      logDiagnostic(threadId, 'recovery_failure', {
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: state.recoveryAttempts + 1
      });

      return {
        success: false,
        recoveredMessages: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, [state.lastRecoveryAttempt, state.recoveryAttempts, logDiagnostic, toast]);

  // Export conversation for backup
  const exportConversation = useCallback((
    threadId: string,
    messages: ChatMessage[]
  ): string => {
    const exportData = {
      threadId,
      userId,
      exportTimestamp: new Date().toISOString(),
      messageCount: messages.length,
      messages: messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender,
        created_at: msg.created_at,
        // Include minimal metadata for recovery
        reference_entries: msg.reference_entries,
        analysis_data: msg.analysis_data
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }, [userId]);

  // Clean up old diagnostics
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - DIAGNOSTIC_RETENTION;
      
      setState(prev => {
        const newDiagnostics = new Map();
        for (const [key, diagnostic] of prev.diagnostics) {
          if (diagnostic.timestamp > cutoff) {
            newDiagnostics.set(key, diagnostic);
          }
        }
        return {
          ...prev,
          diagnostics: newDiagnostics
        };
      });
    }, DIAGNOSTIC_RETENTION / 2);

    return () => clearInterval(cleanupInterval);
  }, []);

  return {
    isRecovering: state.isRecovering,
    recoveryAttempts: state.recoveryAttempts,
    failedThreads: state.failedThreads,
    detectInconsistencies,
    attemptRecovery,
    exportConversation,
    logDiagnostic,
    diagnostics: state.diagnostics
  };
};