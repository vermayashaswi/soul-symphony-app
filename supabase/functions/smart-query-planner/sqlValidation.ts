// SQL Validation and Sanitization for Smart Query Planner

export function validateAndSanitizeSQL(sqlQuery: string, requestId: string): { isValid: boolean; sanitizedQuery?: string; error?: string } {
  try {
    console.log(`[${requestId}] Validating SQL query: ${sqlQuery.substring(0, 200)}...`);
    
    // Basic SQL injection prevention
    const dangerousPatterns = [
      /;\s*(drop|delete|update|insert|create|alter)\s+/i,
      /union\s+select/i,
      /exec(\s|\()/i,
      /sp_/i
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(sqlQuery)) {
        return { isValid: false, error: 'SQL contains potentially dangerous patterns' };
      }
    }
    
    // Check for invalid timezone expressions that cause PostgreSQL errors
    const invalidTimezonePatterns = [
      /'[^']*days ago[^']*'/i,  // '7 days ago (Asia/Kolkata)'
      /'[^']*week[^']*timezone[^']*'/i,  // 'last week in Asia/Kolkata timezone'
      /\(NOW\(\)\s+AT\s+TIME\s+ZONE\s+.*INTERVAL/i,  // Complex timezone + interval expressions
      /AT\s+TIME\s+ZONE\s+.*AT\s+TIME\s+ZONE/i,  // Double AT TIME ZONE expressions
    ];
    
    for (const pattern of invalidTimezonePatterns) {
      if (pattern.test(sqlQuery)) {
        console.error(`[${requestId}] Invalid timezone expression detected: ${pattern}`);
        return { 
          isValid: false, 
          error: 'SQL contains invalid timezone expressions that will cause PostgreSQL errors' 
        };
      }
    }
    
    // Sanitize the query - remove trailing semicolons and extra whitespace
    const sanitizedQuery = sqlQuery.trim().replace(/;+$/, '');
    
    // Basic structure validation
    if (!sanitizedQuery.toLowerCase().startsWith('select')) {
      return { isValid: false, error: 'Only SELECT queries are allowed' };
    }
    
    // Check for required user filtering
    if (!sanitizedQuery.toLowerCase().includes('user_id') || !sanitizedQuery.toLowerCase().includes('auth.uid()')) {
      return { isValid: false, error: 'Query must include user_id = auth.uid() filtering' };
    }
    
    console.log(`[${requestId}] SQL query validation passed`);
    return { isValid: true, sanitizedQuery };
    
  } catch (error) {
    console.error(`[${requestId}] SQL validation error:`, error);
    return { isValid: false, error: `Validation error: ${error.message}` };
  }
}

export function suggestSimpleAlternative(originalQuery: string, userMessage: string): string {
  // Extract key intentions from the original query
  const isTimeFiltered = /interval|days|week|month/i.test(originalQuery);
  const isEmotionFocused = /emotions/i.test(originalQuery);
  const isThemeFocused = /themes|master_themes/i.test(originalQuery);
  
  let fallbackQuery = 'SELECT id, created_at, "refined text", master_themes, emotions, sentiment FROM "Journal Entries" WHERE user_id = auth.uid()';
  
  if (isTimeFiltered) {
    fallbackQuery += ' AND created_at >= NOW() - INTERVAL \'30 days\'';
  }
  
  fallbackQuery += ' ORDER BY created_at DESC LIMIT 25';
  
  return fallbackQuery;
}