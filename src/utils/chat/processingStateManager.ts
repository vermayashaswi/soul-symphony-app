import { supabase } from "@/integrations/supabase/client";

/**
 * Manages processing state for chat messages to prevent race conditions
 */
export class ProcessingStateManager {
  private static instance: ProcessingStateManager;
  private processingMessages = new Set<string>();
  private messageTimeouts = new Map<string, NodeJS.Timeout>();
  
  private constructor() {}
  
  static getInstance(): ProcessingStateManager {
    if (!ProcessingStateManager.instance) {
      ProcessingStateManager.instance = new ProcessingStateManager();
    }
    return ProcessingStateManager.instance;
  }
  
  /**
   * Marks a message as processing and sets up a timeout to prevent it from getting stuck
   */
  startProcessing(messageId: string, timeoutMs: number = 5 * 60 * 1000): void {
    console.log(`[ProcessingStateManager] Starting processing for message ${messageId}`);
    
    this.processingMessages.add(messageId);
    
    // Clear any existing timeout
    if (this.messageTimeouts.has(messageId)) {
      clearTimeout(this.messageTimeouts.get(messageId)!);
    }
    
    // Set a timeout to automatically mark as completed if it gets stuck
    const timeout = setTimeout(async () => {
      console.warn(`[ProcessingStateManager] Message ${messageId} processing timed out, marking as completed`);
      await this.forceComplete(messageId);
    }, timeoutMs);
    
    this.messageTimeouts.set(messageId, timeout);
  }
  
  /**
   * Marks a message as completed processing
   */
  async completeProcessing(messageId: string, finalContent?: string): Promise<boolean> {
    console.log(`[ProcessingStateManager] Completing processing for message ${messageId}`);
    
    this.processingMessages.delete(messageId);
    
    // Clear timeout
    if (this.messageTimeouts.has(messageId)) {
      clearTimeout(this.messageTimeouts.get(messageId)!);
      this.messageTimeouts.delete(messageId);
    }
    
    // Update the message in the database
    try {
      const updateData: any = { is_processing: false };
      if (finalContent !== undefined) {
        updateData.content = finalContent;
      }
      
      const { error } = await supabase
        .from('chat_messages')
        .update(updateData)
        .eq('id', messageId);
      
      if (error) {
        console.error(`[ProcessingStateManager] Error updating message ${messageId}:`, error);
        return false;
      }
      
      console.log(`[ProcessingStateManager] Successfully completed processing for message ${messageId}`);
      return true;
    } catch (error) {
      console.error(`[ProcessingStateManager] Exception updating message ${messageId}:`, error);
      return false;
    }
  }
  
  /**
   * Force completes a message that appears to be stuck
   */
  private async forceComplete(messageId: string): Promise<void> {
    try {
      await this.completeProcessing(messageId, "Error: Message processing timed out. Please try again.");
    } catch (error) {
      console.error(`[ProcessingStateManager] Error force completing message ${messageId}:`, error);
    }
  }
  
  /**
   * Checks if a message is currently being processed
   */
  isProcessing(messageId: string): boolean {
    return this.processingMessages.has(messageId);
  }
  
  /**
   * Gets all currently processing message IDs
   */
  getCurrentlyProcessing(): string[] {
    return Array.from(this.processingMessages);
  }
  
  /**
   * Clears all processing state (useful for cleanup)
   */
  clearAll(): void {
    console.log('[ProcessingStateManager] Clearing all processing state');
    
    // Clear all timeouts
    for (const timeout of this.messageTimeouts.values()) {
      clearTimeout(timeout);
    }
    
    this.processingMessages.clear();
    this.messageTimeouts.clear();
  }
  
  /**
   * Recovers stuck messages by checking database state vs memory state
   */
  async recoverStuckMessages(): Promise<void> {
    try {
      console.log('[ProcessingStateManager] Recovering stuck messages...');
      
      // Get messages that are marked as processing in the database
      const { data: dbProcessingMessages, error } = await supabase
        .from('chat_messages')
        .select('id, created_at')
        .eq('is_processing', true);
      
      if (error) {
        console.error('[ProcessingStateManager] Error checking database processing messages:', error);
        return;
      }
      
      if (!dbProcessingMessages || dbProcessingMessages.length === 0) {
        console.log('[ProcessingStateManager] No processing messages found in database');
        return;
      }
      
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      
      for (const msg of dbProcessingMessages) {
        const messageAge = new Date(msg.created_at).getTime();
        const isStuck = messageAge < fiveMinutesAgo;
        const notInMemory = !this.processingMessages.has(msg.id);
        
        if (isStuck || notInMemory) {
          console.log(`[ProcessingStateManager] Recovering stuck message ${msg.id} (stuck: ${isStuck}, not in memory: ${notInMemory})`);
          await this.forceComplete(msg.id);
        }
      }
      
    } catch (error) {
      console.error('[ProcessingStateManager] Error recovering stuck messages:', error);
    }
  }
}

// Export singleton instance
export const processingStateManager = ProcessingStateManager.getInstance();