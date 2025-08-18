
export async function executeSQLAnalysis(step: any, userId: string, supabaseClient: any, requestId: string, executionDetails: any) {
  try {
    console.log(`[${requestId}] Executing SQL query:`, step.sqlQuery);
    
    if (!step.sqlQuery || !step.sqlQuery.trim()) {
      console.log(`[${requestId}] No SQL query provided, using vector search fallback`);
      executionDetails.fallbackUsed = true;
      return await executeVectorSearchFallback(step, userId, supabaseClient, requestId);
    }

    const originalQuery = step.sqlQuery.trim();
    executionDetails.originalQuery = originalQuery;
    
    // Enhanced validation including time range requirements
    const validationResult = validateSQLQuery(originalQuery, requestId, step.timeRange);
    executionDetails.validationResult = validationResult;
    
    if (!validationResult.isValid) {
      console.error(`[${requestId}] SQL query validation failed: ${validationResult.error}`);
      executionDetails.fallbackUsed = true;
      return await executeVectorSearchFallback(step, userId, supabaseClient, requestId);
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
      return await executeVectorSearchFallback(step, userId, supabaseClient, requestId);
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
      
      // INTELLIGENT FALLBACK: Use vector search instead of basic SQL
      console.log(`[${requestId}] SQL execution failed, falling back to vector search`);
      return await executeVectorSearchFallback(step, userId, supabaseClient, requestId);
    }

    if (data && data.success && data.data) {
      console.log(`[${requestId}] SQL query executed successfully, rows:`, data.data.length);
      // If SQL query executed but returned 0 results, try vector fallback
      if (data.data.length === 0) {
        console.log(`[${requestId}] SQL query returned 0 results, falling back to vector search`);
        executionDetails.fallbackUsed = true;
        return await executeVectorSearchFallback(step, userId, supabaseClient, requestId);
      }
      return data.data;
    } else {
      console.warn(`[${requestId}] SQL query returned no results or failed:`, data);
      executionDetails.fallbackUsed = true;
      return await executeVectorSearchFallback(step, userId, supabaseClient, requestId);
    }

  } catch (error) {
    console.error(`[${requestId}] Error in SQL analysis:`, error);
    executionDetails.executionError = error.message;
    executionDetails.fallbackUsed = true;
    // INTELLIGENT FALLBACK: Use vector search instead of basic SQL
    console.log(`[${requestId}] SQL analysis error, falling back to vector search`);
    return await executeVectorSearchFallback(step, userId, supabaseClient, requestId);
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
    
    // Check for dangerous operations using word boundaries to prevent false positives
    const dangerousKeywords = ['DROP', 'DELETE FROM', 'INSERT INTO', 'UPDATE SET', 'CREATE', 'ALTER', 'TRUNCATE'];
    for (const keyword of dangerousKeywords) {
      // Use word boundary regex to avoid false positives like "COALESCE" containing "CREATE"
      const keywordRegex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (keywordRegex.test(upperQuery)) {
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

// NEW INTELLIGENT VECTOR SEARCH FALLBACK FUNCTION
async function executeVectorSearchFallback(step: any, userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] Executing vector search fallback`);
  
  try {
    // Extract query context from the original step
    let searchQuery = '';
    if (step.description) {
      searchQuery = step.description;
    } else if (step.sqlQuery) {
      // Extract meaningful terms from the SQL query for vector search
      searchQuery = extractSearchTermsFromSQL(step.sqlQuery);
    } else {
      searchQuery = 'personal thoughts feelings experiences';
    }

    console.log(`[${requestId}] Vector fallback search query: ${searchQuery}`);

    // Generate embedding for the search query
    const embedding = await generateEmbedding(searchQuery);
    
    // Primary vector search with relaxed threshold
    const primaryThreshold = 0.2;
    const fallbackThreshold = 0.15;
    
    let vectorResults;
    
    // First try with time range if available
    if (step.timeRange && (step.timeRange.start || step.timeRange.end)) {
      console.log(`[${requestId}] Vector fallback with time range: ${step.timeRange.start} to ${step.timeRange.end}`);
      const { data, error } = await supabaseClient.rpc('match_journal_entries_with_date', {
        query_embedding: embedding,
        match_threshold: primaryThreshold,
        match_count: 15,
        user_id_filter: userId,
        start_date: step.timeRange.start || null,
        end_date: step.timeRange.end || null
      });

      if (error) {
        console.error(`[${requestId}] Time-filtered vector fallback error:`, error);
        vectorResults = null;
      } else {
        vectorResults = data;
      }
    }
    
    // If no time range results or no time range specified, try basic vector search
    if (!vectorResults || vectorResults.length === 0) {
      console.log(`[${requestId}] Vector fallback without time constraints`);
      const { data, error } = await supabaseClient.rpc('match_journal_entries', {
        query_embedding: embedding,
        match_threshold: primaryThreshold,
        match_count: 15,
        user_id_filter: userId
      });

      if (error) {
        console.error(`[${requestId}] Basic vector fallback error:`, error);
        vectorResults = null;
      } else {
        vectorResults = data;
      }
    }
    
    // If still no results, try with lower threshold
    if (!vectorResults || vectorResults.length === 0) {
      console.log(`[${requestId}] Vector fallback with lower threshold: ${fallbackThreshold}`);
      const { data, error } = await supabaseClient.rpc('match_journal_entries', {
        query_embedding: embedding,
        match_threshold: fallbackThreshold,
        match_count: 15,
        user_id_filter: userId
      });

      if (error) {
        console.error(`[${requestId}] Low threshold vector fallback error:`, error);
        vectorResults = null;
      } else {
        vectorResults = data;
      }
    }
    
    // Final fallback to basic SQL if vector search completely fails
    if (!vectorResults || vectorResults.length === 0) {
      console.log(`[${requestId}] Vector fallback failed, using basic SQL as last resort`);
      return await executeBasicSQLQuery(userId, supabaseClient, requestId);
    }

    console.log(`[${requestId}] Vector fallback successful, found ${vectorResults.length} results`);
    return vectorResults;

  } catch (error) {
    console.error(`[${requestId}] Error in vector search fallback:`, error);
    // Absolute last resort - basic SQL query
    console.log(`[${requestId}] Vector fallback error, using basic SQL as absolute last resort`);
    return await executeBasicSQLQuery(userId, supabaseClient, requestId);
  }
}

// Helper function to extract search terms from SQL queries
function extractSearchTermsFromSQL(sqlQuery: string): string {
  // Extract meaningful terms from SQL for vector search
  const terms = [];
  
  // Look for theme references
  const themeMatches = sqlQuery.match(/'([^']+)'/g);
  if (themeMatches) {
    terms.push(...themeMatches.map(match => match.replace(/'/g, '')));
  }
  
  // Look for emotion references
  const emotionMatches = sqlQuery.match(/emotions.*?'([^']+)'/g);
  if (emotionMatches) {
    terms.push(...emotionMatches.map(match => match.replace(/.*'([^']+)'.*/, '$1')));
  }
  
  // Default meaningful search if no specific terms found
  if (terms.length === 0) {
    terms.push('feelings', 'thoughts', 'experiences', 'emotions');
  }
  
  return terms.join(' ');
}

async function generateEmbedding(text: string): Promise<number[]> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
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
