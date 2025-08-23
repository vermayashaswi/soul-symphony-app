
export async function executeSQLAnalysis(step: any, userId: string, supabaseClient: any, requestId: string, executionDetails: any, userTimezone: string = 'UTC') {
  try {
    console.log(`[${requestId}] [SQL EXECUTION START] Query type: ${step.sqlQueryType || 'unknown'}`);
    console.log(`[${requestId}] [SQL RAW QUERY]`, step.sqlQuery);
    executionDetails.queryType = step.sqlQueryType;
    
    if (!step.sqlQuery || !step.sqlQuery.trim()) {
      console.log(`[${requestId}] [SQL FAILURE] No SQL query provided, using vector search fallback`);
      executionDetails.fallbackUsed = true;
      executionDetails.fallbackReason = 'No SQL query provided';
      return await executeVectorSearchFallback(step, userId, supabaseClient, requestId);
    }

    const originalQuery = step.sqlQuery.trim().replace(/;+$/, '');
    executionDetails.originalQuery = originalQuery;
    
    // Enhanced query validation before sanitization
    const validationResult = validateSQLQuery(originalQuery, requestId);
    executionDetails.validationResult = validationResult;
    
    if (!validationResult.isValid) {
      console.error(`[${requestId}] [SQL VALIDATION FAILED]`, validationResult.errors);
      executionDetails.executionError = `Query validation failed: ${validationResult.errors.join(', ')}`;
      executionDetails.fallbackUsed = true;
      executionDetails.fallbackReason = 'Query validation failed';
      return await executeVectorSearchFallback(step, userId, supabaseClient, requestId);
    }
    
    // Sanitize user ID in the query
    let sanitizedQuery;
    try {
      sanitizedQuery = sanitizeUserIdInQuery(originalQuery, userId, requestId);
      executionDetails.sanitizedQuery = sanitizedQuery;
      console.log(`[${requestId}] [SQL SANITIZED]`, sanitizedQuery);
    } catch (sanitizeError) {
      console.error(`[${requestId}] [SQL SANITIZATION FAILED]`, sanitizeError);
      executionDetails.executionError = sanitizeError.message;
      executionDetails.fallbackUsed = true;
      executionDetails.fallbackReason = 'Query sanitization failed';
      return await executeVectorSearchFallback(step, userId, supabaseClient, requestId);
    }
    
    // Use the execute_dynamic_query function to safely run GPT-generated SQL
    console.log(`[${requestId}] Executing sanitized query via RPC:`, sanitizedQuery.substring(0, 200) + '...');
    
    const { data, error } = await supabaseClient.rpc('execute_dynamic_query', {
      query_text: sanitizedQuery,
      user_timezone: userTimezone
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
      console.log(`[${requestId}] [SQL SUCCESS] Query executed successfully, rows:`, data.data.length);
      console.log(`[${requestId}] [SQL RESULT SAMPLE]`, data.data.slice(0, 2));
      
      // ENHANCED: Different handling for analysis vs filtering queries
      if (step.sqlQueryType === 'analysis') {
        // For analysis queries (COUNT, SUM, AVG, etc.), always return computed results
        console.log(`[${requestId}] [SQL ANALYSIS] Completed with ${data.data.length} result rows`);
        executionDetails.resultCount = data.data.length;
        executionDetails.resultType = 'analysis_success';
        return data.data;
      } else if (step.sqlQueryType === 'filtering') {
        // For filtering queries, fall back to vector search if no results found
        if (data.data.length === 0) {
          console.log(`[${requestId}] [SQL FILTERING] Query returned 0 results, falling back to vector search`);
          executionDetails.fallbackUsed = true;
          executionDetails.fallbackReason = 'Filtering query returned 0 results';
          executionDetails.resultCount = 0;
          executionDetails.resultType = 'filtering_empty';
          return await executeVectorSearchFallback(step, userId, supabaseClient, requestId);
        }
        console.log(`[${requestId}] [SQL FILTERING] Success with ${data.data.length} entries`);
        executionDetails.resultCount = data.data.length;
        executionDetails.resultType = 'filtering_success';
        return data.data;
      } else {
        // LEGACY: Auto-detect based on content (backward compatibility)
        const hasAggregateFields = data.data.some((row: any) => 
          row.avg_sentiment !== undefined || 
          row.entry_count !== undefined || 
          row.total_entries !== undefined ||
          row.percentage !== undefined ||
          row.count !== undefined
        );
        
        if (hasAggregateFields) {
          // Treat as analysis query
          console.log(`[${requestId}] [SQL AUTO-DETECTED] Analysis query with ${data.data.length} computed results`);
          executionDetails.resultCount = data.data.length;
          executionDetails.resultType = 'auto_detected_analysis';
          return data.data;
        } else {
          // Treat as filtering query
          if (data.data.length === 0) {
            console.log(`[${requestId}] [SQL AUTO-DETECTED] Filtering query returned 0 results, falling back to vector search`);
            executionDetails.fallbackUsed = true;
            executionDetails.fallbackReason = 'Auto-detected filtering query returned 0 results';
            executionDetails.resultCount = 0;
            executionDetails.resultType = 'auto_detected_filtering_empty';
            return await executeVectorSearchFallback(step, userId, supabaseClient, requestId);
          }
          console.log(`[${requestId}] [SQL AUTO-DETECTED] Filtering success with ${data.data.length} entries`);
          executionDetails.resultCount = data.data.length;
          executionDetails.resultType = 'auto_detected_filtering_success';
          return data.data;
        }
      }
    } else {
      console.warn(`[${requestId}] [SQL FAILURE] Query returned no results or failed:`, data);
      executionDetails.fallbackUsed = true;
      executionDetails.fallbackReason = 'SQL query returned no valid data';
      executionDetails.resultCount = 0;
      executionDetails.resultType = 'sql_failure';
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
    .limit(25); // Fixed: increased limit from 10 to 25 to get more accurate results

  if (error) {
    console.error(`[${requestId}] Basic SQL query error:`, error);
    throw error;
  }

  console.log(`[${requestId}] Basic SQL query results:`, data?.length || 0);
  return data || [];
}


// ENHANCED INTELLIGENT VECTOR SEARCH FALLBACK FUNCTION
async function executeVectorSearchFallback(step: any, userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] [VECTOR FALLBACK START] Executing vector search fallback`);
  
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

    console.log(`[${requestId}] [VECTOR FALLBACK] Search query: ${searchQuery}`);

    // Generate embedding for the search query
    const embedding = await generateEmbedding(searchQuery);
    console.log(`[${requestId}] [VECTOR FALLBACK] Generated embedding successfully`);
    
    // Primary vector search with relaxed threshold
    const primaryThreshold = 0.2;
    const fallbackThreshold = 0.15;
    
    let vectorResults;
    let searchAttempt = 1;
    
    // Enhanced time range handling
    if (step.timeRange && (step.timeRange.start || step.timeRange.end)) {
      console.log(`[${requestId}] [VECTOR FALLBACK ATTEMPT ${searchAttempt}] With time range: ${step.timeRange.start} to ${step.timeRange.end}`);
      
      try {
        const { data, error } = await supabaseClient.rpc('match_journal_entries_with_date', {
          query_embedding: embedding,
          match_threshold: primaryThreshold,
          match_count: 15,
          user_id_filter: userId,
          start_date: step.timeRange.start || null,
          end_date: step.timeRange.end || null
        });

        if (error) {
          console.error(`[${requestId}] [VECTOR FALLBACK ERROR] Time-filtered search failed:`, error);
          console.error(`[${requestId}] [VECTOR FALLBACK ERROR] RPC function may be missing or broken`);
          vectorResults = null;
        } else {
          vectorResults = data;
          console.log(`[${requestId}] [VECTOR FALLBACK SUCCESS] Time-filtered search returned ${vectorResults?.length || 0} results`);
        }
      } catch (rpcError) {
        console.error(`[${requestId}] [VECTOR FALLBACK ERROR] RPC call failed:`, rpcError);
        vectorResults = null;
      }
      searchAttempt++;
    }
    
    // If no time range results or no time range specified, try basic vector search
    if (!vectorResults || vectorResults.length === 0) {
      console.log(`[${requestId}] [VECTOR FALLBACK ATTEMPT ${searchAttempt}] Without time constraints`);
      
      try {
        const { data, error } = await supabaseClient.rpc('match_journal_entries', {
          query_embedding: embedding,
          match_threshold: primaryThreshold,
          match_count: 15,
          user_id_filter: userId
        });

        if (error) {
          console.error(`[${requestId}] [VECTOR FALLBACK ERROR] Basic search failed:`, error);
          vectorResults = null;
        } else {
          vectorResults = data;
          console.log(`[${requestId}] [VECTOR FALLBACK SUCCESS] Basic search returned ${vectorResults?.length || 0} results`);
        }
      } catch (rpcError) {
        console.error(`[${requestId}] [VECTOR FALLBACK ERROR] Basic RPC call failed:`, rpcError);
        vectorResults = null;
      }
      searchAttempt++;
    }
    
    // If still no results, try with lower threshold
    if (!vectorResults || vectorResults.length === 0) {
      console.log(`[${requestId}] [VECTOR FALLBACK ATTEMPT ${searchAttempt}] With lower threshold: ${fallbackThreshold}`);
      
      try {
        const { data, error } = await supabaseClient.rpc('match_journal_entries', {
          query_embedding: embedding,
          match_threshold: fallbackThreshold,
          match_count: 15,
          user_id_filter: userId
        });

        if (error) {
          console.error(`[${requestId}] [VECTOR FALLBACK ERROR] Low threshold search failed:`, error);
          vectorResults = null;
        } else {
          vectorResults = data;
          console.log(`[${requestId}] [VECTOR FALLBACK SUCCESS] Low threshold search returned ${vectorResults?.length || 0} results`);
        }
      } catch (rpcError) {
        console.error(`[${requestId}] [VECTOR FALLBACK ERROR] Low threshold RPC call failed:`, rpcError);
        vectorResults = null;
      }
      searchAttempt++;
    }
    
    // Final fallback to basic SQL if vector search completely fails
    if (!vectorResults || vectorResults.length === 0) {
      console.log(`[${requestId}] [VECTOR FALLBACK FAILED] All vector search attempts failed, using basic SQL as last resort`);
      const basicResults = await executeBasicSQLQuery(userId, supabaseClient, requestId);
      console.log(`[${requestId}] [BASIC SQL FALLBACK] Returned ${basicResults?.length || 0} results`);
      return basicResults;
    }

    console.log(`[${requestId}] [VECTOR FALLBACK COMPLETE] Successfully found ${vectorResults.length} results`);
    return vectorResults;

  } catch (error) {
    console.error(`[${requestId}] [VECTOR FALLBACK FATAL ERROR] Unexpected error in vector search fallback:`, error);
    // Absolute last resort - basic SQL query
    console.log(`[${requestId}] [VECTOR FALLBACK FATAL ERROR] Using basic SQL as absolute last resort`);
    const basicResults = await executeBasicSQLQuery(userId, supabaseClient, requestId);
    console.log(`[${requestId}] [BASIC SQL FINAL FALLBACK] Returned ${basicResults?.length || 0} results`);
    return basicResults;
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

// Enhanced SQL query validation function
function validateSQLQuery(query: string, requestId: string): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log(`[${requestId}] [SQL VALIDATION] Starting validation for query`);
  
  // Check for forbidden operations
  const forbiddenOps = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'CREATE', 'ALTER', 'TRUNCATE'];
  const upperQuery = query.toUpperCase();
  
  for (const op of forbiddenOps) {
    if (upperQuery.includes(op)) {
      errors.push(`Forbidden operation detected: ${op}`);
    }
  }
  
  // Check for required user_id filter
  if (!query.toLowerCase().includes('user_id') && !query.toLowerCase().includes('auth.uid()')) {
    errors.push('Query must include user_id filter for security');
  }
  
  // Check for proper table name usage
  if (query.includes('"Journal Entries"') === false && query.toLowerCase().includes('journal') && query.toLowerCase().includes('entries')) {
    warnings.push('Table name should be properly quoted as "Journal Entries"');
  }
  
  // Check for forbidden columns that might cause issues
  const forbiddenColumns = ['password', 'email', 'auth_token'];
  for (const col of forbiddenColumns) {
    if (query.toLowerCase().includes(col)) {
      errors.push(`Forbidden column access: ${col}`);
    }
  }
  
  const isValid = errors.length === 0;
  
  console.log(`[${requestId}] [SQL VALIDATION] Result: ${isValid ? 'VALID' : 'INVALID'}`, {
    errors,
    warnings,
    queryLength: query.length
  });
  
  return { isValid, errors, warnings };
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
  
  // Fix common table name issues
  sanitizedQuery = sanitizedQuery.replace(/journal_entries/gi, '"Journal Entries"');
  sanitizedQuery = sanitizedQuery.replace(/journalentries/gi, '"Journal Entries"');
  
  console.log(`[${requestId}] [SQL SANITIZATION] Original: ${query.substring(0, 100)}...`);
  console.log(`[${requestId}] [SQL SANITIZATION] Sanitized: ${sanitizedQuery.substring(0, 100)}...`);
  
  return sanitizedQuery;
}
