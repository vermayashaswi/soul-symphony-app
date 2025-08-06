// Utility functions for parsing and processing chat message content

export interface ParsedMessageContent {
  response?: string;
  userStatusMessage?: string;
  analysis?: any;
  references?: any[];
  hasNumericResult?: boolean;
  originalContent: string;
  isParsedJSON: boolean;
}

/**
 * Attempts to parse message content as JSON and extract the response field
 * Falls back to original content if parsing fails or no response field exists
 */
export const parseMessageContent = (content: string): ParsedMessageContent => {
  const result: ParsedMessageContent = {
    originalContent: content,
    isParsedJSON: false
  };

  if (!content) {
    return result;
  }

  try {
    // Try to parse as JSON
    const parsed = JSON.parse(content);
    
    if (typeof parsed === 'object' && parsed !== null) {
      result.isParsedJSON = true;
      
      // Extract the response field if it exists
      if (parsed.response && typeof parsed.response === 'string') {
        result.response = parsed.response;
      }
      
      // Extract other potential fields
      if (parsed.userStatusMessage) {
        result.userStatusMessage = parsed.userStatusMessage;
      }
      
      if (parsed.analysis) {
        result.analysis = parsed.analysis;
      }
      
      if (parsed.references) {
        result.references = parsed.references;
      }
      
      if (parsed.hasNumericResult !== undefined) {
        result.hasNumericResult = parsed.hasNumericResult;
      }
      
      console.log('[MessageParser] Successfully parsed JSON content:', {
        hasResponse: !!result.response,
        hasUserStatusMessage: !!result.userStatusMessage,
        hasAnalysis: !!result.analysis
      });
    }
  } catch (error) {
    // Not valid JSON, use original content
    console.log('[MessageParser] Content is not JSON, using as-is');
  }

  return result;
};

/**
 * Gets the display content for a message, preferring parsed response over original content
 */
export const getDisplayContent = (content: string): string => {
  const parsed = parseMessageContent(content);
  
  // Prefer the response field if it exists and has content
  if (parsed.response && parsed.response.trim()) {
    return parsed.response;
  }
  
  // Fall back to original content
  return parsed.originalContent;
};

/**
 * Checks if content appears to be malformed JSON (contains JSON-like structure but incomplete)
 */
export const isMalformedJSON = (content: string): boolean => {
  if (!content) return false;
  
  // Check for JSON-like patterns
  const hasJsonPatterns = content.includes('{') || content.includes('[') || content.includes('"response"') || content.includes('"userStatusMessage"');
  
  if (!hasJsonPatterns) return false;
  
  try {
    JSON.parse(content);
    return false; // Valid JSON, not malformed
  } catch {
    return true; // Has JSON patterns but fails to parse
  }
};

/**
 * Attempts to recover content from malformed JSON
 */
export const recoverFromMalformedJSON = (content: string): string => {
  if (!isMalformedJSON(content)) {
    return content;
  }
  
  // Try to extract response field using regex as fallback
  const responseMatch = content.match(/"response"\s*:\s*"([^"]+)"/);
  if (responseMatch && responseMatch[1]) {
    console.log('[MessageParser] Recovered response from malformed JSON');
    return responseMatch[1];
  }
  
  // Try to extract any quoted string that looks like a response
  const quotedTextMatch = content.match(/"([^"]{20,})"/);
  if (quotedTextMatch && quotedTextMatch[1]) {
    console.log('[MessageParser] Recovered quoted text from malformed JSON');
    return quotedTextMatch[1];
  }
  
  console.warn('[MessageParser] Could not recover content from malformed JSON');
  return content;
};