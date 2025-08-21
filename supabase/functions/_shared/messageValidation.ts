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
  try {
    // Enhanced JSON sanitization and parsing with multiple fallback strategies
    let jsonString = rawResponse.trim();
    
    // Remove common markdown formatting
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    // Enhanced sanitization for escaped quotes and common JSON issues
    jsonString = jsonString
      .replace(/\\"/g, '"')  // Fix escaped quotes
      .replace(/"\s*:\s*\\"/g, '": "')  // Fix escaped values
      .replace(/\\n/g, '\n')  // Fix escaped newlines
      .replace(/\\\\/g, '\\')  // Fix double escapes
      .trim();

    // First parsing attempt
    try {
      return JSON.parse(jsonString);
    } catch (firstParseError) {
      console.log('[MessageValidation] First parse failed, trying fallback strategies...');
      
      // Strategy 2: Try to extract JSON from within text
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (secondParseError) {
          // Strategy 3: Try fixing common quote issues
          let fixedJson = jsonMatch[0]
            .replace(/": "([^"]*)"([^,}\]]*)/g, '": "$1$2"')  // Fix broken quotes
            .replace(/""([^"]*)""/g, '"$1"')  // Fix double quotes
            .replace(/"([^"]*)""/g, '"$1"');  // Fix trailing double quotes
          
          return JSON.parse(fixedJson);
        }
      } else {
        throw new Error(`No JSON object found in response: ${firstParseError.message}`);
      }
    }
  } catch (error) {
    console.error('[MessageValidation] All parsing strategies failed:', error);
    throw error;
  }
}