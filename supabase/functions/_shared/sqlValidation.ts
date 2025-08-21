/**
 * SQL validation and debugging utilities
 * Provides comprehensive SQL execution monitoring and fallback strategies
 */

export interface SQLExecutionResult {
  success: boolean;
  data?: any[];
  error?: string;
  executionTime?: number;
  queryDetails?: {
    original: string;
    sanitized: string;
    hasTimeVariables: boolean;
    timezone: string;
  };
  fallbackUsed?: boolean;
  debugInfo?: any;
}

/**
 * Enhanced SQL execution with comprehensive debugging
 */
export async function executeWithDebug(
  supabaseClient: any,
  query: string,
  userId: string,
  userTimezone: string = 'UTC',
  requestId: string
): Promise<SQLExecutionResult> {
  const startTime = Date.now();
  
  console.log(`[${requestId}] [SQL DEBUG] Starting execution with timezone: ${userTimezone}`);
  console.log(`[${requestId}] [SQL DEBUG] Original query: ${query.substring(0, 200)}...`);
  
  const result: SQLExecutionResult = {
    success: false,
    queryDetails: {
      original: query,
      sanitized: '',
      hasTimeVariables: query.includes('__'),
      timezone: userTimezone
    }
  };
  
  try {
    // Sanitize user ID in query
    const sanitizedQuery = sanitizeUserIdInQuery(query, userId, requestId);
    result.queryDetails!.sanitized = sanitizedQuery;
    
    console.log(`[${requestId}] [SQL DEBUG] Sanitized query: ${sanitizedQuery.substring(0, 200)}...`);
    
    // Execute with timezone support
    const { data, error } = await supabaseClient.rpc('execute_dynamic_query', {
      query_text: sanitizedQuery,
      user_timezone: userTimezone
    });
    
    result.executionTime = Date.now() - startTime;
    
    if (error) {
      console.error(`[${requestId}] [SQL DEBUG] Execution error:`, {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      result.error = error.message;
      result.debugInfo = {
        code: error.code,
        details: error.details,
        hint: error.hint,
        query: sanitizedQuery.substring(0, 500)
      };
      
      return result;
    }
    
    if (data && data.success) {
      console.log(`[${requestId}] [SQL DEBUG] Execution successful:`, {
        rowCount: data.data?.length || 0,
        executionTime: result.executionTime,
        timezone: data.timezone_info?.user_timezone
      });
      
      result.success = true;
      result.data = data.data || [];
      result.debugInfo = {
        rowCount: data.data?.length || 0,
        timezoneInfo: data.timezone_info
      };
      
      return result;
    } else {
      console.warn(`[${requestId}] [SQL DEBUG] Invalid response format:`, data);
      result.error = 'Invalid response format from SQL execution';
      result.debugInfo = { responseData: data };
      return result;
    }
    
  } catch (error) {
    result.executionTime = Date.now() - startTime;
    result.error = error.message;
    result.debugInfo = { exception: error.toString() };
    
    console.error(`[${requestId}] [SQL DEBUG] Exception during execution:`, error);
    return result;
  }
}

/**
 * Simplified fallback chain: SQL -> Vector (no multiple cascades)
 */
export async function executeWithSimpleFallback(
  supabaseClient: any,
  step: any,
  userId: string,
  userTimezone: string,
  requestId: string
): Promise<{ data: any[]; usedFallback: boolean; executionDetails: any }> {
  
  console.log(`[${requestId}] [FALLBACK] Starting simplified execution chain`);
  
  const executionDetails = {
    sqlAttempted: false,
    sqlSuccess: false,
    vectorFallbackUsed: false,
    errors: []
  };
  
  // 1. Try SQL if we have a query
  if (step.sqlQuery && step.sqlQuery.trim()) {
    executionDetails.sqlAttempted = true;
    
    const sqlResult = await executeWithDebug(
      supabaseClient,
      step.sqlQuery,
      userId,
      userTimezone,
      requestId
    );
    
    if (sqlResult.success && sqlResult.data && sqlResult.data.length > 0) {
      console.log(`[${requestId}] [FALLBACK] SQL succeeded with ${sqlResult.data.length} results`);
      executionDetails.sqlSuccess = true;
      return {
        data: sqlResult.data,
        usedFallback: false,
        executionDetails
      };
    } else {
      console.log(`[${requestId}] [FALLBACK] SQL failed or returned no results: ${sqlResult.error || 'no data'}`);
      executionDetails.errors.push(sqlResult.error || 'SQL returned no results');
    }
  }
  
  // 2. Vector fallback
  console.log(`[${requestId}] [FALLBACK] Using vector fallback`);
  executionDetails.vectorFallbackUsed = true;
  
  try {
    const vectorData = await executeVectorFallback(step, userId, supabaseClient, requestId);
    console.log(`[${requestId}] [FALLBACK] Vector fallback succeeded with ${vectorData?.length || 0} results`);
    
    return {
      data: vectorData || [],
      usedFallback: true,
      executionDetails
    };
  } catch (vectorError) {
    console.error(`[${requestId}] [FALLBACK] Vector fallback failed:`, vectorError);
    executionDetails.errors.push(`Vector fallback failed: ${vectorError.message}`);
    
    // Return empty data rather than throwing
    return {
      data: [],
      usedFallback: true,
      executionDetails
    };
  }
}

/**
 * Simple vector fallback implementation
 */
async function executeVectorFallback(step: any, userId: string, supabaseClient: any, requestId: string): Promise<any[]> {
  console.log(`[${requestId}] [VECTOR FALLBACK] Starting vector search fallback`);
  
  // Extract search terms from step
  let searchQuery = '';
  if (step.description) {
    searchQuery = step.description;
  } else if (step.sqlQuery) {
    searchQuery = extractSearchTermsFromSQL(step.sqlQuery);
  } else {
    searchQuery = 'personal thoughts feelings experiences emotions';
  }
  
  console.log(`[${requestId}] [VECTOR FALLBACK] Search query: ${searchQuery}`);
  
  // Generate embedding
  const embedding = await generateEmbedding(searchQuery);
  
  // Try vector search with time constraints if available
  if (step.timeRange && (step.timeRange.start || step.timeRange.end)) {
    console.log(`[${requestId}] [VECTOR FALLBACK] Using time-constrained search`);
    
    const { data, error } = await supabaseClient.rpc('match_journal_entries_with_date', {
      query_embedding: embedding,
      match_threshold: 0.2,
      match_count: 15,
      user_id_filter: userId,
      start_date: step.timeRange.start || null,
      end_date: step.timeRange.end || null
    });
    
    if (!error && data && data.length > 0) {
      return data;
    }
  }
  
  // Try standard vector search
  console.log(`[${requestId}] [VECTOR FALLBACK] Using standard vector search`);
  const { data, error } = await supabaseClient.rpc('match_journal_entries', {
    query_embedding: embedding,
    match_threshold: 0.2,
    match_count: 15,
    user_id_filter: userId
  });
  
  if (error) {
    throw new Error(`Vector search failed: ${error.message}`);
  }
  
  return data || [];
}

function sanitizeUserIdInQuery(query: string, userId: string, requestId: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new Error('Invalid user ID format');
  }
  
  let sanitizedQuery = query.replace(/auth\.uid\(\)/g, `'${userId}'`);
  sanitizedQuery = sanitizedQuery.replace(/user_id\s*=\s*([a-f0-9-]{36})/gi, `user_id = '${userId}'`);
  
  return sanitizedQuery;
}

function extractSearchTermsFromSQL(sqlQuery: string): string {
  const terms = [];
  
  // Extract quoted terms
  const quoteMatches = sqlQuery.match(/'([^']+)'/g);
  if (quoteMatches) {
    terms.push(...quoteMatches.map(match => match.replace(/'/g, '')));
  }
  
  // Default terms if nothing found
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