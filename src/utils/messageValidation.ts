/**
 * Utility functions for validating and sanitizing message content
 */

/**
 * Check if a message content looks like malformed JSON
 */
export function isMessageContentMalformed(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  
  // Check if content looks like JSON but should be plain text
  if (content.trim().startsWith('{') && content.includes('"response"') && content.includes('"userStatusMessage"')) {
    try {
      const parsed = JSON.parse(content);
      return !!(parsed.response && parsed.userStatusMessage);
    } catch {
      return false;
    }
  }
  
  return false;
}

/**
 * Extract readable text from malformed JSON message content
 */
export function extractReadableContent(content: string): string {
  if (!isMessageContentMalformed(content)) {
    return content;
  }
  
  try {
    const parsed = JSON.parse(content);
    return parsed.response || parsed.content || parsed.message || 'Unable to display message content';
  } catch {
    return 'Unable to display message content';
  }
}

/**
 * Validate that message content is a proper string, not JSON object
 */
export function validateMessageContent(content: any): string {
  if (typeof content === 'string') {
    // If it's already a string, check if it's malformed JSON
    if (isMessageContentMalformed(content)) {
      return extractReadableContent(content);
    }
    return content;
  }
  
  if (typeof content === 'object' && content !== null) {
    // If it's an object, try to extract the response field
    return content.response || content.content || content.message || JSON.stringify(content);
  }
  
  return String(content || 'Message content unavailable');
}

/**
 * Safe message content renderer that handles malformed content gracefully
 */
export function safeRenderMessageContent(content: any): {
  text: string;
  isMalformed: boolean;
  originalContent?: string;
} {
  const originalContent = typeof content === 'string' ? content : JSON.stringify(content);
  const isMalformed = isMessageContentMalformed(originalContent);
  const text = validateMessageContent(content);
  
  return {
    text,
    isMalformed,
    originalContent: isMalformed ? originalContent : undefined
  };
}

/**
 * Log message content issues for debugging
 */
export function logMessageContentIssue(messageId: string, content: any, issue: string) {
  console.warn(`[MessageValidation] ${issue}:`, {
    messageId,
    contentType: typeof content,
    contentPreview: typeof content === 'string' ? content.substring(0, 100) : JSON.stringify(content).substring(0, 100),
    isMalformed: isMessageContentMalformed(String(content))
  });
}