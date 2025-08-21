import { supabase } from '@/integrations/supabase/client';

export interface MessageLifecycleEvent {
  messageId: string | null;
  threadId: string;
  stage: 'streaming' | 'persisted' | 'displayed' | 'failed';
  timestamp: number;
  content?: string;
  error?: string;
  source: 'streaming' | 'database' | 'realtime' | 'ui';
}

class MessageLifecycleTracker {
  private events: Map<string, MessageLifecycleEvent[]> = new Map();
  private missingMessages: Set<string> = new Set();

  trackEvent(event: MessageLifecycleEvent) {
    const key = `${event.threadId}:${event.messageId || 'temp'}`;
    if (!this.events.has(key)) {
      this.events.set(key, []);
    }
    this.events.get(key)!.push(event);
    
    console.log(`[MessageLifecycle] ${event.stage} - Thread: ${event.threadId}, Message: ${event.messageId}, Source: ${event.source}`);
    
    // Check for complete lifecycle
    this.validateMessageLifecycle(key);
  }

  private validateMessageLifecycle(key: string) {
    const events = this.events.get(key) || [];
    const stages = events.map(e => e.stage);
    
    // Check if message completed full lifecycle (streaming -> persisted -> displayed)
    const hasStreaming = stages.includes('streaming');
    const hasPersisted = stages.includes('persisted');
    const hasDisplayed = stages.includes('displayed');
    const hasFailed = stages.includes('failed');
    
    if (hasStreaming && !hasPersisted && !hasFailed) {
      // Message is streaming but not yet persisted - this is normal during active streaming
      return;
    }
    
    if (hasStreaming && hasPersisted && !hasDisplayed) {
      // Message is persisted but not displayed - potential UI sync issue
      const threadId = events[0].threadId;
      console.warn(`[MessageLifecycle] Message persisted but not displayed: ${key}`);
      this.missingMessages.add(threadId);
      
      // Auto-trigger UI sync after a delay
      setTimeout(() => {
        this.syncMissingMessages(threadId);
      }, 3000);
    }
  }

  private async syncMissingMessages(threadId: string) {
    if (!this.missingMessages.has(threadId)) return;
    
    try {
      console.log(`[MessageLifecycle] Syncing missing messages for thread: ${threadId}`);
      
      // Trigger a custom event to force UI refresh
      window.dispatchEvent(new CustomEvent('syncMissingMessages', {
        detail: { threadId }
      }));
      
      this.missingMessages.delete(threadId);
    } catch (error) {
      console.error(`[MessageLifecycle] Error syncing missing messages:`, error);
    }
  }

  async validateThreadConsistency(threadId: string, uiMessages: any[]) {
    try {
      // Get all persisted messages for this thread
      const { data: dbMessages, error } = await supabase
        .from('chat_messages')
        .select('id, content, sender, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error(`[MessageLifecycle] Error fetching messages for validation:`, error);
        return;
      }
      
      if (!dbMessages) return;
      
      const dbAssistantMessages = dbMessages.filter(m => m.sender === 'assistant');
      const uiAssistantMessages = uiMessages.filter(m => m.role === 'assistant');
      
      // Check for missing messages in UI
      const missingInUI = dbAssistantMessages.filter(dbMsg => 
        !uiAssistantMessages.some(uiMsg => uiMsg.content === dbMsg.content)
      );
      
      if (missingInUI.length > 0) {
        console.warn(`[MessageLifecycle] Found ${missingInUI.length} messages in DB not displayed in UI`);
        
        // Track each missing message
        missingInUI.forEach(msg => {
          this.trackEvent({
            messageId: msg.id,
            threadId,
            stage: 'persisted',
            timestamp: Date.now(),
            content: msg.content,
            source: 'database'
          });
        });
        
        // Trigger sync
        this.missingMessages.add(threadId);
        setTimeout(() => this.syncMissingMessages(threadId), 1000);
      }
      
    } catch (error) {
      console.error(`[MessageLifecycle] Error validating thread consistency:`, error);
    }
  }

  getThreadReport(threadId: string) {
    const threadEvents = Array.from(this.events.entries())
      .filter(([key]) => key.startsWith(`${threadId}:`))
      .map(([key, events]) => ({ key, events }));
    
    return {
      totalMessages: threadEvents.length,
      completedLifecycles: threadEvents.filter(({ events }) => 
        events.some(e => e.stage === 'displayed')
      ).length,
      missingMessages: this.missingMessages.has(threadId),
      events: threadEvents
    };
  }

  clearThreadData(threadId: string) {
    // Clean up tracking data for thread
    const keysToDelete = Array.from(this.events.keys())
      .filter(key => key.startsWith(`${threadId}:`));
    
    keysToDelete.forEach(key => this.events.delete(key));
    this.missingMessages.delete(threadId);
  }
}

export const messageLifecycleTracker = new MessageLifecycleTracker();