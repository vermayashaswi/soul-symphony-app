export async function executeSQLAnalysis(step: any, userId: string, supabaseClient: any, requestId: string, executionDetails: any, userTimezone: string = 'UTC') {
  try {
    console.log(`[${requestId}] Enhanced SQL execution (${step.sqlQueryType || 'unknown'}):`, step.sqlQuery);
    executionDetails.queryType = step.sqlQueryType;
    executionDetails.enhancedValidation = true;
    
    if (!step.sqlQuery || !step.sqlQuery.trim()) {
      console.log(`[${requestId}] No SQL query provided, using enhanced vector search fallback`);
      executionDetails.fallbackUsed = true;
      return await executeEnhancedVectorSearchFallback(step, userId, supabaseClient, requestId);
    }

    const originalQuery = step.sqlQuery.trim().replace(/;+$/, '');
    executionDetails.originalQuery = originalQuery;
    
    // Enhanced query validation before execution
    const validation = validateSQLQuery(originalQuery);
    executionDetails.validationResult = validation;
    
    if (!validation.isValid) {
      console.error(`[${requestId}] SQL validation failed:`, validation.errors);
      console.log(`[${requestId}] Suggestions:`, validation.suggestions);
      
      // Try to rewrite the query
      const rewritten = rewriteProblematicSQL(originalQuery);
      if (rewritten !== originalQuery) {
        console.log(`[${requestId}] Attempting to use rewritten query`);
        executionDetails.rewrittenQuery = rewritten;
        return await executeSQLAnalysis({...step, sqlQuery: rewritten}, userId, supabaseClient, requestId, executionDetails, userTimezone);
      } else {
        console.warn(`[${requestId}] Could not rewrite problematic SQL, falling back to vector search`);
        executionDetails.fallbackUsed = true;
        return await executeEnhancedVectorSearchFallback(step, userId, supabaseClient, requestId);
      }
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
      return await executeEnhancedVectorSearchFallback(step, userId, supabaseClient, requestId);
    }
    
    // Use the execute_dynamic_query function to safely run GPT-generated SQL
    console.log(`[${requestId}] Executing enhanced validated query via RPC:`, sanitizedQuery.substring(0, 200) + '...');
    
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
        
        // Specific error handling for common issues
        if (error.code === '42883') {
          console.error(`[${requestId}] Function does not exist - likely JSONB query issue`);
        } else if (error.code === '42601') {
          console.error(`[${requestId}] Syntax error - check query structure`);
        } else if (error.code === '42703') {
          console.error(`[${requestId}] Column not found - check column names and quoting`);
        }
      }
      if (error.details) {
        console.error(`[${requestId}] PostgreSQL error details: ${error.details}`);
      }
      if (error.hint) {
        console.error(`[${requestId}] PostgreSQL error hint: ${error.hint}`);
      }
      
      // ENHANCED FALLBACK: Use vector search with preserved time constraints
      console.log(`[${requestId}] SQL execution failed, falling back to enhanced vector search with time preservation`);
      return await executeEnhancedVectorSearchFallback(step, userId, supabaseClient, requestId);
    }

    if (data && data.success && data.data) {
      console.log(`[${requestId}] Enhanced SQL query executed successfully, rows:`, data.data.length);
      
      // ENHANCED: Different handling for analysis vs filtering queries
      if (step.sqlQueryType === 'analysis') {
        // For analysis queries (COUNT, SUM, AVG, etc.), always return computed results
        console.log(`[${requestId}] Analysis query completed with ${data.data.length} result rows`);
        return data.data;
      } else if (step.sqlQueryType === 'filtering') {
        // For filtering queries, fall back to vector search if no results found
        if (data.data.length === 0) {
          console.log(`[${requestId}] Filtering query returned 0 results, falling back to enhanced vector search`);
          executionDetails.fallbackUsed = true;
          return await executeEnhancedVectorSearchFallback(step, userId, supabaseClient, requestId);
        }
        return data.data;
      } else {
        // LEGACY: Auto-detect based on content (backward compatibility)
        const hasAggregateFields = data.data.some((row: any) => 
          row.avg_sentiment !== undefined || 
          row.entry_count !== undefined || 
          row.total_entries !== undefined ||
          row.percentage !== undefined ||
          row.count !== undefined ||
          row.avg_score !== undefined
        );
        
        if (hasAggregateFields) {
          // Treat as analysis query
          console.log(`[${requestId}] Auto-detected analysis query with ${data.data.length} computed results`);
          return data.data;
        } else {
          // Treat as filtering query
          if (data.data.length === 0) {
            console.log(`[${requestId}] Auto-detected filtering query returned 0 results, falling back to enhanced vector search`);
            executionDetails.fallbackUsed = true;
            return await executeEnhancedVectorSearchFallback(step, userId, supabaseClient, requestId);
          }
          return data.data;
        }
      }
    } else {
      console.warn(`[${requestId}] SQL query returned no results or failed:`, data);
      executionDetails.fallbackUsed = true;
      return await executeEnhancedVectorSearchFallback(step, userId, supabaseClient, requestId);
    }

  } catch (error) {
    console.error(`[${requestId}] Error in enhanced SQL analysis:`, error);
    executionDetails.executionError = error.message;
    executionDetails.fallbackUsed = true;
    // ENHANCED FALLBACK: Use vector search with preserved time constraints
    console.log(`[${requestId}] SQL analysis error, falling back to enhanced vector search`);
    return await executeEnhancedVectorSearchFallback(step, userId, supabaseClient, requestId);
  }
}

/**
 * Enhanced vector search validation to catch common patterns before execution
 */
function validateSQLQuery(sqlQuery: string): { isValid: boolean; errors: string[]; suggestions: string[] } {
  const errors: string[] = [];
  const suggestions: string[] = [];
  
  // Check for common JSONB mistakes
  if (sqlQuery.includes('json_object_keys(emotions)')) {
    errors.push('Using json_object_keys() with JSONB data type');
    suggestions.push('Use jsonb_object_keys(emotions) for JSONB columns or jsonb_each(emotions) for key-value iteration');
  }
  
  // Check for problematic nested aggregation patterns
  if (sqlQuery.includes('AVG((emotions->>jsonb_object_keys(emotions))::numeric)')) {
    errors.push('Nested aggregation with jsonb_object_keys in AVG function');
    suggestions.push('Use jsonb_each(emotions) in FROM clause with proper grouping');
  }
  
  // Check for incorrect emotion querying patterns
  if (sqlQuery.includes('emotions->') && !sqlQuery.includes('::numeric') && !sqlQuery.includes('::text')) {
    suggestions.push('Remember to cast JSONB values: (emotions->>\'emotion_name\')::numeric');
  }
  
  // Check for table name quoting
  if (sqlQuery.includes('Journal Entries') && !sqlQuery.includes('"Journal Entries"')) {
    errors.push('Table name with spaces must be quoted');
    suggestions.push('Use "Journal Entries" (with quotes) for table name');
  }
  
  // Check for column name issues
  if (sqlQuery.includes('refined text') && !sqlQuery.includes('"refined text"')) {
    errors.push('Column name with spaces must be quoted');
    suggestions.push('Use "refined text" (with quotes) for column name');
  }
  
  // Check for forbidden column references
  const forbiddenColumns = ['transcription_text', 'refined_text', 'journal_entries'];
  for (const forbidden of forbiddenColumns) {
    if (sqlQuery.toLowerCase().includes(forbidden)) {
      errors.push(`Forbidden column reference: ${forbidden}`);
      suggestions.push('Use correct column names: "refined text", "Journal Entries"');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    suggestions
  };
}

/**
 * Rewrite problematic SQL patterns to working ones
 */
function rewriteProblematicSQL(sqlQuery: string): string {
  let rewritten = sqlQuery;
  
  // Fix json_object_keys for JSONB
  rewritten = rewritten.replace(/json_object_keys\(emotions\)/g, 'jsonb_object_keys(emotions)');
  
  // Fix problematic nested aggregation - replace with proper JSONB iteration
  if (rewritten.includes('jsonb_object_keys(emotions)') && rewritten.includes('AVG((emotions->>jsonb_object_keys(emotions))::numeric)')) {
    console.log('Rewriting problematic nested JSONB aggregation');
    
    // Extract time constraint if present
    const timeConstraintMatch = rewritten.match(/AND created_at[^)]+\)/);
    const timeConstraint = timeConstraintMatch ? timeConstraintMatch[0] : '';
    
    // Replace with proper JSONB iteration using jsonb_each
    rewritten = `WITH emotion_scores AS (
      SELECT e.key as emotion_name, (e.value::text)::numeric as emotion_score
      FROM "Journal Entries" entries, jsonb_each(entries.emotions) e
      WHERE entries.user_id = auth.uid() ${timeConstraint}
    )
    SELECT emotion_name as emotion, ROUND(AVG(emotion_score), 3) as avg_score 
    FROM emotion_scores 
    GROUP BY emotion_name
    ORDER BY avg_score DESC LIMIT 5`;
  }
  
  // Add proper table and column quoting
  rewritten = rewritten.replace(/Journal Entries(?!")/g, '"Journal Entries"');
  rewritten = rewritten.replace(/refined text(?!")/g, '"refined text"');
  
  return rewritten;
}

// ENHANCED VECTOR SEARCH FALLBACK WITH PROGRESSIVE TIME CONSTRAINT HANDLING
async function executeEnhancedVectorSearchFallback(step: any, userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] Enhanced vector search fallback with progressive time handling`);
  
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

    console.log(`[${requestId}] Enhanced vector fallback search query: ${searchQuery}`);
    
    // CRITICAL: Preserve original time constraints from step
    const preservedTimeRange = step.timeRange;
    if (preservedTimeRange) {
      console.log(`[${requestId}] PRESERVING original time constraints: ${JSON.stringify(preservedTimeRange)}`);
    }

    // Generate embedding for the search query
    const embedding = await generateEmbedding(searchQuery);
    
    // Enhanced threshold strategy with progressive expansion
    const primaryThreshold = 0.25;
    const secondaryThreshold = 0.2;
    const fallbackThreshold = 0.15;
    
    let vectorResults = null;
    let timeExpansionUsed = false;
    
    // PRIORITY 1: Try with preserved time range if available
    if (preservedTimeRange && (preservedTimeRange.start || preservedTimeRange.end)) {
      console.log(`[${requestId}] Enhanced vector fallback with PRESERVED time range: ${preservedTimeRange.start} to ${preservedTimeRange.end}`);
      
      // Try multiple thresholds with time constraints first
      const thresholds = [primaryThreshold, secondaryThreshold, fallbackThreshold];
      
      for (const threshold of thresholds) {
        try {
          const { data, error } = await supabaseClient.rpc('match_journal_entries_with_date', {
            query_embedding: embedding,
            match_threshold: threshold,
            match_count: 15,
            user_id_filter: userId,
            start_date: preservedTimeRange.start || null,
            end_date: preservedTimeRange.end || null
          });

          if (error) {
            console.error(`[${requestId}] Time-filtered vector fallback error at threshold ${threshold}:`, error);
            continue;
          } else if (data && data.length > 0) {
            console.log(`[${requestId}] Time-filtered vector fallback successful at threshold ${threshold}: ${data.length} results`);
            vectorResults = data;
            break;
          } else {
            console.log(`[${requestId}] Time-filtered vector fallback returned 0 results at threshold ${threshold}`);
          }
        } catch (timeFilterError) {
          console.error(`[${requestId}] Error in time-filtered vector search at threshold ${threshold}:`, timeFilterError);
        }
      }
      
      // PROGRESSIVE TIME EXPANSION: If no results with original time range, try expanding
      if (!vectorResults || vectorResults.length === 0) {
        console.log(`[${requestId}] No results with original time range, attempting progressive time expansion`);
        
        // Expand time range progressively
        const timeRanges = generateExpandedTimeRanges(preservedTimeRange);
        
        for (const expandedRange of timeRanges) {
          console.log(`[${requestId}] Trying expanded time range: ${expandedRange.start} to ${expandedRange.end}`);
          
          try {
            const { data, error } = await supabaseClient.rpc('match_journal_entries_with_date', {
              query_embedding: embedding,
              match_threshold: fallbackThreshold,
              match_count: 15,
              user_id_filter: userId,
              start_date: expandedRange.start,
              end_date: expandedRange.end
            });

            if (!error && data && data.length > 0) {
              console.log(`[${requestId}] Expanded time range successful: ${data.length} results`);
              vectorResults = data;
              timeExpansionUsed = true;
              break;
            }
          } catch (expandedError) {
            console.error(`[${requestId}] Error in expanded time range search:`, expandedError);
          }
        }
      }
    }
    
    // PRIORITY 2: Only if ALL time-constrained searches fail, try without time constraints
    if (!vectorResults || vectorResults.length === 0) {
      console.log(`[${requestId}] ALL time-constrained searches failed, trying without time constraints as LAST resort`);
      
      try {
        const { data, error } = await supabaseClient.rpc('match_journal_entries', {
          query_embedding: embedding,
          match_threshold: fallbackThreshold,
          match_count: 15,
          user_id_filter: userId
        });

        if (error) {
          console.error(`[${requestId}] Basic vector fallback error:`, error);
        } else if (data && data.length > 0) {
          console.log(`[${requestId}] Basic vector fallback successful: ${data.length} results`);
          vectorResults = data;
        }
      } catch (basicVectorError) {
        console.error(`[${requestId}] Error in basic vector search:`, basicVectorError);
      }
    }
    
    // Final fallback to basic SQL if vector search completely fails
    if (!vectorResults || vectorResults.length === 0) {
      console.log(`[${requestId}] ALL vector search attempts failed, using enhanced basic SQL as last resort`);
      return await executeBasicSQLQuery(userId, supabaseClient, requestId);
    }

    console.log(`[${requestId}] Enhanced vector fallback successful, found ${vectorResults.length} results${timeExpansionUsed ? ' (with time expansion)' : ''}`);
    return vectorResults;

  } catch (error) {
    console.error(`[${requestId}] Error in enhanced vector search fallback:`, error);
    // Absolute last resort - basic SQL query
    console.log(`[${requestId}] Enhanced vector fallback error, using basic SQL as absolute last resort`);
    return await executeBasicSQLQuery(userId, supabaseClient, requestId);
  }
}

/**
 * Generate progressively expanded time ranges for better results
 */
function generateExpandedTimeRanges(originalRange: any): any[] {
  if (!originalRange || (!originalRange.start && !originalRange.end)) {
    return [];
  }
  
  const ranges = [];
  const start = new Date(originalRange.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const end = new Date(originalRange.end || new Date());
  
  // Expand by doubling the time range
  const duration = end.getTime() - start.getTime();
  const expandedStart = new Date(start.getTime() - duration);
  const expandedEnd = new Date(end.getTime() + duration);
  
  ranges.push({
    start: expandedStart.toISOString(),
    end: expandedEnd.toISOString()
  });
  
  // Expand to last 30 days if not already larger
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (start > thirtyDaysAgo) {
    ranges.push({
      start: thirtyDaysAgo.toISOString(),
      end: new Date().toISOString()
    });
  }
  
  return ranges;
}

export async function executeBasicSQLQuery(userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] Executing enhanced basic fallback SQL query`);
  
  const { data, error } = await supabaseClient
    .from('Journal Entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30); // Enhanced: increased limit for better results

  if (error) {
    console.error(`[${requestId}] Enhanced basic SQL query error:`, error);
    throw error;
  }

  console.log(`[${requestId}] Enhanced basic SQL query results:`, data?.length || 0);
  return data || [];
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
