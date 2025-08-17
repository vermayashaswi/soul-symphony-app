
/**
 * SQL Validation utility to prevent invalid JSONB queries
 */

export interface SQLValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedQuery?: string;
}

/**
 * Validates SQL queries to ensure they use correct JSONB syntax
 */
export function validateSQL(query: string): SQLValidationResult {
  const errors: string[] = [];
  
  // Critical: Check for invalid json_object_keys usage
  if (query.includes('json_object_keys')) {
    errors.push('Invalid function: json_object_keys() - use jsonb_each() instead');
  }
  
  // Check for invalid JSONB patterns
  const invalidPatterns = [
    /json_object_keys\s*\(/gi,
    /json_each\s*\(/gi, // Should be jsonb_each
    /->>\s*\'\w+\'\s*AS\s+INTEGER/gi, // Invalid casting pattern
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(query)) {
      errors.push(`Invalid SQL pattern detected: ${pattern.source}`);
    }
  }
  
  // Ensure required JSONB patterns are present for emotion/entity queries
  if (query.includes('emotions') && !query.includes('jsonb_each')) {
    errors.push('Emotion queries must use jsonb_each() for JSONB operations');
  }
  
  if (query.includes('entities') && !query.includes('jsonb_each')) {
    errors.push('Entity queries must use jsonb_each() for JSONB operations');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedQuery: errors.length === 0 ? query : undefined
  };
}

/**
 * SQL Template system for common operations
 */
export const SQL_TEMPLATES = {
  topEmotions: `
    SELECT emotion_key, AVG((emotion_value::text)::float) as avg_score, COUNT(*) as frequency 
    FROM "Journal Entries", jsonb_each(emotions) as em(emotion_key, emotion_value) 
    WHERE user_id = $user_id 
    AND emotion_key IN ($emotion_list)
    GROUP BY emotion_key 
    ORDER BY avg_score DESC 
    LIMIT $limit;
  `,
  
  emotionsByTimeRange: `
    SELECT emotion_key, AVG((emotion_value::text)::float) as avg_score, COUNT(*) as frequency 
    FROM "Journal Entries", jsonb_each(emotions) as em(emotion_key, emotion_value) 
    WHERE user_id = $user_id 
    AND created_at >= $start_date 
    AND created_at <= $end_date
    AND emotion_key IN ($emotion_list)
    GROUP BY emotion_key 
    ORDER BY avg_score DESC 
    LIMIT $limit;
  `,
  
  entitiesByType: `
    SELECT entity_key as entity_type, entity_item as entity_name, COUNT(*) as frequency
    FROM "Journal Entries", 
         jsonb_each(entities) as ent(entity_key, entity_value),
         jsonb_array_elements_text(entity_value) as entity_item
    WHERE user_id = $user_id
    GROUP BY entity_key, entity_item
    ORDER BY frequency DESC
    LIMIT $limit;
  `
};

/**
 * Safe SQL template substitution
 */
export function substituteTemplate(template: string, params: Record<string, any>): string {
  let query = template;
  
  for (const [key, value] of Object.entries(params)) {
    const placeholder = `$${key}`;
    
    if (Array.isArray(value)) {
      // Handle array parameters (e.g., emotion lists)
      const quotedValues = value.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
      query = query.replace(placeholder, quotedValues);
    } else if (typeof value === 'string') {
      // Escape single quotes in string values
      query = query.replace(placeholder, `'${value.replace(/'/g, "''")}'`);
    } else {
      // Handle numbers and other primitives
      query = query.replace(placeholder, String(value));
    }
  }
  
  return query;
}
