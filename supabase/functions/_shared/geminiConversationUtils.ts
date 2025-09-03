/**
 * Shared utilities for formatting conversation context for Gemini API
 * Converts plain text conversation history to Gemini's optimal structured format
 */

export interface ConversationMessage {
  content: string;
  sender: string;
  role?: string;
  created_at?: string;
  timestamp?: string;
  id?: string;
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface FormattedConversationOptions {
  maxMessages?: number;
  includeSystemMessage?: boolean;
  systemMessage?: string;
}

/**
 * Formats conversation history for Gemini's structured contents array
 * @param conversationContext - Array of conversation messages
 * @param systemMessage - System message to include as first exchange
 * @param options - Configuration options
 * @returns Formatted contents array for Gemini API
 */
export function formatConversationForGemini(
  conversationContext: ConversationMessage[] = [],
  systemMessage?: string,
  options: FormattedConversationOptions = {}
): GeminiContent[] {
  const {
    maxMessages = 10,
    includeSystemMessage = true,
  } = options;

  const contents: GeminiContent[] = [];

  // Add system message as first user/model exchange if provided
  if (includeSystemMessage && systemMessage) {
    contents.push(
      {
        role: 'user',
        parts: [{ text: systemMessage }]
      },
      {
        role: 'model',
        parts: [{ text: 'I understand my role and guidelines. I\'m ready to help.' }]
      }
    );
  }

  // Process conversation history
  if (conversationContext && conversationContext.length > 0) {
    const recentMessages = conversationContext
      .slice(-maxMessages) // Take only recent messages
      .sort((a, b) => {
        // Sort chronologically (oldest to newest)
        const dateA = new Date(a.created_at || a.timestamp || 0).getTime();
        const dateB = new Date(b.created_at || b.timestamp || 0).getTime();
        return dateA - dateB;
      });

    // Convert to Gemini format
    for (const msg of recentMessages) {
      const role = mapToGeminiRole(msg.sender || msg.role || 'user');
      contents.push({
        role,
        parts: [{ text: msg.content || '' }]
      });
    }
  }

  return contents;
}

/**
 * Maps conversation roles to Gemini's role system
 */
function mapToGeminiRole(role: string): 'user' | 'model' {
  const normalizedRole = role.toLowerCase();
  if (normalizedRole === 'assistant' || normalizedRole === 'model') {
    return 'model';
  }
  return 'user';
}

/**
 * Builds complete Gemini request body with conversation context
 * @param userMessage - Current user message
 * @param conversationContext - Previous conversation messages
 * @param systemMessage - System prompt/persona
 * @param options - Additional options
 * @returns Complete contents array for Gemini API request
 */
export function buildGeminiContents(
  userMessage: string,
  conversationContext: ConversationMessage[] = [],
  systemMessage?: string,
  options: FormattedConversationOptions = {}
): GeminiContent[] {
  const conversationContents = formatConversationForGemini(
    conversationContext,
    systemMessage,
    options
  );

  // Add current user message
  conversationContents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  return conversationContents;
}

/**
 * Validates and logs conversation context for debugging
 */
export function logConversationContext(
  conversationContext: ConversationMessage[],
  functionName: string,
  consolidationId?: string
): void {
  const logPrefix = consolidationId ? `[${functionName}] ${consolidationId}` : `[${functionName}]`;
  
  console.log(`${logPrefix} Conversation context:`, {
    messageCount: conversationContext?.length || 0,
    hasMessages: conversationContext && conversationContext.length > 0,
    messageRoles: conversationContext?.map((msg, i) => ({
      index: i,
      role: msg.sender || msg.role || 'unknown',
      contentLength: msg.content?.length || 0,
      hasTimestamp: !!(msg.created_at || msg.timestamp)
    })) || []
  });
}

/**
 * Creates a legacy text format for functions that need it for system prompts
 * (while still using structured format for API calls)
 */
export function createLegacyContextString(
  conversationContext: ConversationMessage[] = [],
  maxMessages: number = 10
): string {
  if (!conversationContext || conversationContext.length === 0) {
    return 'No prior context - this is the first message in the conversation';
  }

  const recentMessages = conversationContext
    .slice(-maxMessages)
    .sort((a, b) => {
      const dateA = new Date(a.created_at || a.timestamp || 0).getTime();
      const dateB = new Date(b.created_at || b.timestamp || 0).getTime();
      return dateA - dateB;
    });

  const contextString = recentMessages
    .map((msg, index) => {
      const role = msg.sender === 'user' ? 'user' : 'assistant';
      const messageOrder = index + 1;
      const timestamp = msg.created_at ? new Date(msg.created_at).toLocaleString() : '';
      return `[Message ${messageOrder}] ${role.toUpperCase()}: ${msg.content}${timestamp ? ` (${timestamp})` : ''}`;
    })
    .join('\n');

  return `Last ${recentMessages.length} messages (chronological order):\n${contextString}`;
}