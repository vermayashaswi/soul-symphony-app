/**
 * Utility functions for maintaining proper message ordering in chat interfaces
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
 * Inserts a new message into the message array while maintaining chronological order
 */
export function insertMessageInOrder(
  messages: UIChatMessage[], 
  newMessage: UIChatMessage
): UIChatMessage[] {
  // Check for duplicate by ID first
  if (newMessage.id && messages.some(msg => msg.id === newMessage.id)) {
    console.log(`[MessageOrdering] Duplicate message ID detected, skipping: ${newMessage.id}`);
    return messages;
  }

  // Check for duplicate by content and proximity (within last 3 messages)
  const recentMessages = messages.slice(-3);
  const isDuplicateContent = recentMessages.some(msg => 
    msg.role === newMessage.role && 
    msg.content?.trim() === newMessage.content?.trim()
  );

  if (isDuplicateContent) {
    console.log(`[MessageOrdering] Duplicate content detected, skipping`);
    return messages;
  }

  // Add the new message
  const updatedMessages = [...messages, newMessage];

  // Sort by timestamp to ensure chronological order
  return updatedMessages.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : Date.now();
    const timeB = b.created_at ? new Date(b.created_at).getTime() : Date.now();
    return timeA - timeB;
  });
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