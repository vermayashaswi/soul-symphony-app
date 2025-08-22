/**
 * Simplified utility functions for chat message ordering
 */

export interface UIChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  references?: any[];
  analysis?: any;
  hasNumericResult?: boolean;
  isProcessing?: boolean;
  created_at?: string;
}

/**
 * Ensures an array of messages is properly sorted chronologically
 */
export function ensureMessageOrder(messages: UIChatMessage[]): UIChatMessage[] {
  return messages.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : Date.now();
    const timeB = b.created_at ? new Date(b.created_at).getTime() : Date.now();
    return timeA - timeB;
  });
}

/**
 * Removes duplicate messages from an array while preserving order
 */
export function deduplicateMessages(messages: UIChatMessage[]): UIChatMessage[] {
  const seen = new Set<string>();
  const deduplicated: UIChatMessage[] = [];

  for (const message of messages) {
    // Create unique key from content + role + timestamp proximity
    const timeStr = message.created_at ? new Date(message.created_at).toISOString().slice(0, 16) : 'no-time';
    const key = message.id || `${message.role}:${message.content?.slice(0, 50)}:${timeStr}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(message);
    }
  }

  return deduplicated;
}