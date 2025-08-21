import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

export interface MessageValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedContent?: string;
}

export interface MessageHealthCheck {
  threadId: string;
  expectedCount?: number;
  healthScore: number;
  issues: string[];
  missingAssistantResponses: number;
  stuckProcessingMessages: number;
}

/**
 * Comprehensive message validation for all edge functions
 */
export function validateMessageContent(content: string, sender: string): MessageValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let sanitizedContent = content;

  // Basic validation
  if (!content || content.trim().length === 0) {
    errors.push('Content cannot be empty');
  }

  if (!sender || !['user', 'assistant', 'error'].includes(sender)) {
    errors.push('Invalid sender type');
  }

  // Content sanitization
  if (content) {
    // Remove potentially problematic JSON artifacts for assistant messages
    if (sender === 'assistant' && content.includes('{"response"')) {
      try {
        const jsonMatch = content.match(/\{"response"\s*:\s*"([^"]+)"/);
        if (jsonMatch) {
          sanitizedContent = jsonMatch[1];
          warnings.push('Extracted response from JSON structure');
        }
      } catch (e) {
        warnings.push('Failed to extract from JSON structure');
      }
    }

    // Check for other formatting issues
    if (content.includes('```json') || content.includes('```')) {
      warnings.push('Content contains markdown formatting');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedContent
  };
}

/**
 * Check message persistence health for a thread
 */
export async function checkMessageHealth(
  supabaseClient: ReturnType<typeof createClient>,
  threadId: string,
  expectedCount?: number
): Promise<MessageHealthCheck> {
  try {
    const { data: healthData, error } = await supabaseClient.rpc(
      'check_message_persistence_health',
      {
        thread_id_param: threadId,
        expected_message_count: expectedCount
      }
    );

    if (error) {
      console.error('[MessageValidation] Health check error:', error);
      return {
        threadId,
        expectedCount,
        healthScore: 0,
        issues: [`Health check failed: ${error.message}`],
        missingAssistantResponses: 0,
        stuckProcessingMessages: 0
      };
    }

    return {
      threadId,
      expectedCount,
      healthScore: healthData.health_score || 0,
      issues: healthData.issues || [],
      missingAssistantResponses: healthData.missing_idempotency_keys || 0,
      stuckProcessingMessages: healthData.stuck_processing_messages || 0
    };
  } catch (error) {
    console.error('[MessageValidation] Health check exception:', error);
    return {
      threadId,
      expectedCount,
      healthScore: 0,
      issues: [`Health check exception: ${error.message}`],
      missingAssistantResponses: 0,
      stuckProcessingMessages: 0
    };
  }
}

/**
 * Auto-recover missing assistant messages
 */
export async function recoverMissingMessages(
  supabaseClient: ReturnType<typeof createClient>,
  threadId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient.rpc('cleanup_stuck_processing_messages');
    
    if (error) {
      console.error('[MessageValidation] Recovery error:', error);
      return false;
    }

    console.log('[MessageValidation] Recovery completed:', data);
    return true;
  } catch (error) {
    console.error('[MessageValidation] Recovery exception:', error);
    return false;
  }
}

/**
 * Enhanced JSON parsing with fallback strategies
 */
export function parseOpenAIResponse(rawResponse: string): any {
  console.log('[parseOpenAIResponse] Starting enhanced parsing...');
  
  if (!rawResponse || rawResponse.trim().length === 0) {
    console.error('[parseOpenAIResponse] Empty response provided');
    throw new Error('Empty response from OpenAI');
  }

  // Pre-sanitize the response
  let sanitized = rawResponse.trim();
  
  // Remove common wrappers that break JSON parsing
  sanitized = sanitized.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  sanitized = sanitized.replace(/^```\s*/, '').replace(/\s*```$/, '');
  sanitized = sanitized.replace(/^Here's the (?:JSON )?response:\s*/i, '');
  sanitized = sanitized.replace(/^(?:Here is|This is) the (?:JSON )?(?:response|result):\s*/i, '');

  // Strategy 1: Direct JSON parsing on sanitized response
  try {
    const directParse = JSON.parse(sanitized);
    console.log('[parseOpenAIResponse] Direct JSON parsing successful');
    return directParse;
  } catch (directError) {
    console.log('[parseOpenAIResponse] Direct parsing failed, trying advanced strategies...');
  }
  
  // Strategy 2: Extract JSON from the sanitized content
  const jsonStart = sanitized.indexOf('{');
  const jsonEnd = sanitized.lastIndexOf('}');
  
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    const extractedJson = sanitized.substring(jsonStart, jsonEnd + 1);
    try {
      const extractedResult = JSON.parse(extractedJson);
      console.log('[parseOpenAIResponse] JSON extraction successful');
      return extractedResult;
    } catch (extractError) {
      console.log('[parseOpenAIResponse] JSON extraction failed');
    }
  }
  
  // Strategy 3: Extract from markdown code blocks
  const codeBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
  let match = codeBlockRegex.exec(rawResponse);
  if (match) {
    try {
      const codeBlockResult = JSON.parse(match[1].trim());
      console.log('[parseOpenAIResponse] Code block extraction successful');
      return codeBlockResult;
    } catch (codeBlockError) {
      console.log('[parseOpenAIResponse] Code block parsing failed');
    }
  }
  
  // Strategy 4: Find JSON object in text and aggressively clean it
  const jsonObjectRegex = /\{[\s\S]*\}/;
  const jsonMatch = rawResponse.match(jsonObjectRegex);
  if (jsonMatch) {
    let jsonString = jsonMatch[0];
    
    try {
      // Aggressive cleaning
      jsonString = jsonString
        .replace(/,\s*}/g, '}')  // Remove trailing commas before }
        .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
        .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3') // Quote unquoted keys
        .replace(/:\s*([^",{\[\]}\s][^",{\[\]}\n]*[^",{\[\]}\s])\s*([,}])/g, ':"$1"$2') // Quote unquoted string values
        .replace(/\\n/g, '\\n') // Fix newline escaping
        .replace(/\\"/g, '\\"'); // Fix quote escaping
      
      const cleanedResult = JSON.parse(jsonString);
      console.log('[parseOpenAIResponse] Aggressively cleaned JSON parsing successful');
      return cleanedResult;
    } catch (cleanError) {
      console.log('[parseOpenAIResponse] Aggressively cleaned JSON parsing failed:', cleanError.message);
    }
  }
  
  // Strategy 5: Try to fix common JSON structural issues
  try {
    let structuralFix = rawResponse;
    
    // Fix missing opening/closing braces
    if (!structuralFix.includes('{')) {
      structuralFix = '{' + structuralFix + '}';
    } else {
      // Ensure we have balanced braces
      const openBraces = (structuralFix.match(/\{/g) || []).length;
      const closeBraces = (structuralFix.match(/\}/g) || []).length;
      
      if (openBraces > closeBraces) {
        structuralFix += '}'.repeat(openBraces - closeBraces);
      }
    }
    
    // Try parsing the structurally fixed version
    const jsonMatch = structuralFix.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const structuralResult = JSON.parse(jsonMatch[0]);
      console.log('[parseOpenAIResponse] Structural fix parsing successful');
      return structuralResult;
    }
  } catch (structuralError) {
    console.log('[parseOpenAIResponse] Structural fix parsing failed');
  }
  
  // Strategy 6: Last resort - try to extract key parts manually
  console.error('[parseOpenAIResponse] All parsing strategies failed');
  console.error('[parseOpenAIResponse] Raw response (first 500 chars):', rawResponse.substring(0, 500));
  console.error('[parseOpenAIResponse] Sanitized response (first 200 chars):', sanitized.substring(0, 200));
  
  throw new Error('Failed to parse OpenAI response after trying all strategies. Response may not contain valid JSON.');
}