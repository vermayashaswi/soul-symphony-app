
export async function executeSQLAnalysis(step: any, userId: string, supabaseClient: any, requestId: string, executionDetails: any) {
  try {
    console.log(`[${requestId}] Executing SQL query:`, step.sqlQuery);
    
    if (!step.sqlQuery || !step.sqlQuery.trim()) {
      console.log(`[${requestId}] No SQL query provided, using fallback`);
      executionDetails.fallbackUsed = true;
      return await executeBasicSQLQuery(userId, supabaseClient, requestId);
    }

    const originalQuery = step.sqlQuery.trim();
    executionDetails.originalQuery = originalQuery;
    
    // Enhanced validation including time range requirements
    const validationResult = validateSQLQuery(originalQuery, requestId, step.timeRange);
    executionDetails.validationResult = validationResult;
    
    if (!validationResult.isValid) {
      console.error(`[${requestId}] SQL query validation failed: ${validationResult.error}`);
      executionDetails.fallbackUsed = true;
      return await executeBasicSQLQuery(userId, supabaseClient, requestId);
    }
    
    // Sanitize user ID in the query
    let sanitizedQuery;
    try {
      sanitizedQuery = sanitizeUserIdInQuery(originalQuery, userId, requestId);
      executionDetails.sanitizedQuery = sanitizedQuery;
    } catch (sanitizeError) {
      console.error(`[${requestId}] Query sanitization failed:`, sanitizeError);
      executionDetails.executionError = sanitizeError.message;
      executionDetails.fallbackUsed = true;
      return await executeBasicSQLQuery(userId, supabaseClient, requestId);
    }
    
    // Use the execute_dynamic_query function to safely run GPT-generated SQL
    console.log(`[${requestId}] Executing sanitized query via RPC:`, sanitizedQuery.substring(0, 200) + '...');
    
    const { data, error } = await supabaseClient.rpc('execute_dynamic_query', {
      query_text: sanitizedQuery
    });

    if (error) {
      console.error(`[${requestId}] SQL execution error:`, error);
      console.error(`[${requestId}] Failed query:`, sanitizedQuery);
      executionDetails.executionError = error.message;
      executionDetails.fallbackUsed = true;
      
      // Enhanced error logging for debugging
      if (error.code) {
        console.error(`[${requestId}] PostgreSQL error code: ${error.code}`);
      }
      if (error.details) {
        console.error(`[${requestId}] PostgreSQL error details: ${error.details}`);
      }
      if (error.hint) {
        console.error(`[${requestId}] PostgreSQL error hint: ${error.hint}`);
      }
      
      // Fallback to basic query if dynamic execution fails
      return await executeBasicSQLQuery(userId, supabaseClient, requestId);
    }

    if (data && data.success && data.data) {
      console.log(`[${requestId}] SQL query executed successfully, rows:`, data.data.length);
      return data.data;
    } else {
      console.warn(`[${requestId}] SQL query returned no results or failed:`, data);
      executionDetails.fallbackUsed = true;
      return await executeBasicSQLQuery(userId, supabaseClient, requestId);
    }

  } catch (error) {
    console.error(`[${requestId}] Error in SQL analysis:`, error);
    executionDetails.executionError = error.message;
    executionDetails.fallbackUsed = true;
    // Fallback to basic query on error
    return await executeBasicSQLQuery(userId, supabaseClient, requestId);
  }
}

export async function executeBasicSQLQuery(userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] Executing basic fallback SQL query`);
  
  const { data, error } = await supabaseClient
    .from('Journal Entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error(`[${requestId}] Basic SQL query error:`, error);
    throw error;
  }

  console.log(`[${requestId}] Basic SQL query results:`, data?.length || 0);
  return data || [];
}

function validateSQLQuery(query: string, requestId: string, timeRange?: any): { isValid: boolean; error?: string } {
  try {
    const upperQuery = query.toUpperCase().trim();
    
    console.log(`[${requestId}] Validating SQL query: ${query.substring(0, 100)}...`);
    
    // Check for dangerous operations
    const dangerousKeywords = ['DROP', 'DELETE FROM', 'INSERT INTO', 'UPDATE SET', 'CREATE', 'ALTER', 'TRUNCATE'];
    for (const keyword of dangerousKeywords) {
      if (upperQuery.includes(keyword)) {
        const error = `Dangerous SQL keyword detected: ${keyword}`;
        console.error(`[${requestId}] ${error}`);
        return { isValid: false, error };
      }
    }
    
    // Ensure it's a SELECT query
    if (!upperQuery.startsWith('SELECT')) {
      const error = 'Only SELECT queries are allowed';
      console.error(`[${requestId}] ${error}`);
      return { isValid: false, error };
    }
    
    // More flexible table reference check - allow various forms
    const hasJournalReference = upperQuery.includes('JOURNAL ENTRIES') || 
                               upperQuery.includes('"JOURNAL ENTRIES"') ||
                               upperQuery.includes('`JOURNAL ENTRIES`') ||
                               upperQuery.includes('ENTRIES');
    
    if (!hasJournalReference) {
      const error = 'Query must reference Journal Entries table';
      console.error(`[${requestId}] ${error}`);
      return { isValid: false, error };
    }
    
    // Enhanced validation: Check if time range is required but missing
    if (timeRange && (timeRange.start || timeRange.end)) {
      const hasTimeFilter = upperQuery.includes('CREATED_AT') && 
                           (upperQuery.includes('>') || upperQuery.includes('<') || upperQuery.includes('BETWEEN'));
      
      if (!hasTimeFilter) {
        console.warn(`[${requestId}] SQL query should include time range filtering but doesn't - timeRange provided: ${JSON.stringify(timeRange)}`);
        // Note: This is a warning, not an error, to maintain backward compatibility
      } else {
        console.log(`[${requestId}] SQL query includes proper time range filtering`);
      }
    }
    
    console.log(`[${requestId}] SQL query validation passed`);
    return { isValid: true };
  } catch (error) {
    console.error(`[${requestId}] SQL validation error:`, error);
    return { isValid: false, error: `Validation error: ${error.message}` };
  }
}

function sanitizeUserIdInQuery(query: string, userId: string, requestId: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    console.error(`[${requestId}] Invalid UUID format for userId: ${userId}`);
    throw new Error('Invalid user ID format');
  }

  console.log(`[${requestId}] Sanitizing SQL query with userId: ${userId}`);
  
  // Replace auth.uid() with properly quoted UUID
  let sanitizedQuery = query.replace(/auth\.uid\(\)/g, `'${userId}'`);
  
  // Also handle any direct user_id references that might need quotes
  sanitizedQuery = sanitizedQuery.replace(/user_id\s*=\s*([a-f0-9-]{36})/gi, `user_id = '${userId}'`);
  
  console.log(`[${requestId}] Original query: ${query}`);
  console.log(`[${requestId}] Sanitized query: ${sanitizedQuery}`);
  
  return sanitizedQuery;
}
