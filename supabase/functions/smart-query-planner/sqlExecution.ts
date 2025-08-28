
export async function executeSQLAnalysis(step: any, userId: string, supabaseClient: any, requestId: string, executionDetails: any, userTimezone: string = 'UTC') {
  try {
    console.log(`[${requestId}] Executing SQL query (${step.sqlQueryType || 'unknown'}):`, step.sqlQuery);
    executionDetails.queryType = step.sqlQueryType;
    
    if (!step.sqlQuery || !step.sqlQuery.trim()) {
      console.log(`[${requestId}] No SQL query provided, using vector search fallback`);
      executionDetails.fallbackUsed = true;
      return await executeVectorSearchFallback(step, userId, supabaseClient, requestId);
    }

    const originalQuery = step.sqlQuery.trim().replace(/;+$/, ''); // Fixed: remove trailing semicolons
    executionDetails.originalQuery = originalQuery;
    
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
      console.log(`[${requestId}] SQL query executed successfully, rows:`, data.data.length);
      
      // ENHANCED: Different handling for analysis vs filtering queries
      if (step.sqlQueryType === 'analysis') {
        // For analysis queries (COUNT, SUM, AVG, etc.), always return computed results
        console.log(`[${requestId}] Analysis query completed with ${data.data.length} result rows`);
        return data.data;
      } else if (step.sqlQueryType === 'filtering') {
        // For filtering queries, fall back to vector search if no results found
        if (data.data.length === 0) {
          console.log(`[${requestId}] Filtering query returned 0 results, falling back to vector search`);
          executionDetails.fallbackUsed = true;
          return await executeVectorSearchFallback(step, userId, supabaseClient, requestId);
        }
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
          console.log(`[${requestId}] Auto-detected analysis query with ${data.data.length} computed results`);
          return data.data;
        } else {
          // Treat as filtering query
          if (data.data.length === 0) {
            console.log(`[${requestId}] Auto-detected filtering query returned 0 results, falling back to vector search`);
            executionDetails.fallbackUsed = true;
            return await executeVectorSearchFallback(step, userId, supabaseClient, requestId);
          }
          return data.data;
        }
      }
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
    .limit(25); // Fixed: increased limit from 10 to 25 to get more accurate results

  if (error) {
    console.error(`[${requestId}] Basic SQL query error:`, error);
    throw error;
  }

  console.log(`[${requestId}] Basic SQL query results:`, data?.length || 0);
  return data || [];
}


// ENHANCED VECTOR SEARCH FALLBACK WITH TIME CONSTRAINT PRESERVATION
async function executeVectorSearchFallback(step: any, userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] Executing vector search fallback with preserved time constraints`);
  
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
    
    // CRITICAL: Preserve original time constraints from step
    const preservedTimeRange = step.timeRange;
    if (preservedTimeRange) {
      console.log(`[${requestId}] Preserving original time constraints: ${JSON.stringify(preservedTimeRange)}`);
    }

    // Generate embedding for the search query
    const embedding = await generateEmbedding(searchQuery);
    
    // Enhanced threshold strategy
    const primaryThreshold = 0.2;
    const fallbackThreshold = 0.15;
    
    let vectorResults = null;
    
    // PRIORITY 1: Try with preserved time range if available
    if (preservedTimeRange && (preservedTimeRange.start || preservedTimeRange.end)) {
      console.log(`[${requestId}] Vector fallback with preserved time range: ${preservedTimeRange.start} to ${preservedTimeRange.end}`);
      
      try {
        const { data, error } = await supabaseClient.rpc('match_journal_entries_with_date', {
          query_embedding: embedding,
          match_threshold: primaryThreshold,
          match_count: 15,
          user_id_filter: userId,
          start_date: preservedTimeRange.start || null,
          end_date: preservedTimeRange.end || null
        });

        if (error) {
          console.error(`[${requestId}] Time-filtered vector fallback error:`, error);
          // Don't null the results yet, try with lower threshold first
        } else if (data && data.length > 0) {
          console.log(`[${requestId}] Time-filtered vector fallback successful: ${data.length} results`);
          vectorResults = data;
        } else {
          console.log(`[${requestId}] Time-filtered vector fallback returned 0 results, trying lower threshold`);
          
          // Try again with lower threshold but KEEP time constraints
          const { data: lowThresholdData, error: lowThresholdError } = await supabaseClient.rpc('match_journal_entries_with_date', {
            query_embedding: embedding,
            match_threshold: fallbackThreshold,
            match_count: 15,
            user_id_filter: userId,
            start_date: preservedTimeRange.start || null,
            end_date: preservedTimeRange.end || null
          });

          if (!lowThresholdError && lowThresholdData && lowThresholdData.length > 0) {
            console.log(`[${requestId}] Time-filtered vector fallback with lower threshold successful: ${lowThresholdData.length} results`);
            vectorResults = lowThresholdData;
          }
        }
      } catch (timeFilterError) {
        console.error(`[${requestId}] Error in time-filtered vector search:`, timeFilterError);
      }
    }
    
    // PRIORITY 2: Only if time-filtered search completely fails, try without time constraints
    if (!vectorResults || vectorResults.length === 0) {
      console.log(`[${requestId}] Time-filtered search yielded no results, trying without time constraints as last resort`);
      
      try {
        const { data, error } = await supabaseClient.rpc('match_journal_entries', {
          query_embedding: embedding,
          match_threshold: primaryThreshold,
          match_count: 15,
          user_id_filter: userId
        });

        if (error) {
          console.error(`[${requestId}] Basic vector fallback error:`, error);
        } else if (data && data.length > 0) {
          console.log(`[${requestId}] Basic vector fallback successful: ${data.length} results`);
          vectorResults = data;
        } else {
          // Try with even lower threshold
          const { data: veryLowData, error: veryLowError } = await supabaseClient.rpc('match_journal_entries', {
            query_embedding: embedding,
            match_threshold: fallbackThreshold,
            match_count: 15,
            user_id_filter: userId
          });

          if (!veryLowError && veryLowData) {
            console.log(`[${requestId}] Very low threshold vector fallback: ${veryLowData.length} results`);
            vectorResults = veryLowData;
          }
        }
      } catch (basicVectorError) {
        console.error(`[${requestId}] Error in basic vector search:`, basicVectorError);
      }
    }
    
    // Final fallback to basic SQL if vector search completely fails
    if (!vectorResults || vectorResults.length === 0) {
      console.log(`[${requestId}] All vector search attempts failed, using basic SQL as last resort`);
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
