// Utility for parallel processing of sub-questions
export interface SubQuestionResult {
  subQuestion: string;
  emotionResults: any[];
  vectorResults: any[];
  hasEntriesInDateRange: boolean;
  context: string;
  reasoning: string;
  totalResults: number;
}

export interface ProcessingContext {
  validatedUserId: string;
  openaiApiKey: string;
  supabaseService: any;
}

export async function processSubQuestionsInParallel(
  subQuestions: any[],
  context: ProcessingContext,
  effectiveDateFilter: any,
  strictDateEnforcement: boolean,
  useAllEntries: boolean = false
): Promise<SubQuestionResult[]> {
  console.log(`[parallel-processor] Processing ${subQuestions.length} sub-questions with enhanced parallel optimization`);
  
  const startTime = Date.now();
  
  // Process sub-questions in smaller batches to optimize connection usage
  const BATCH_SIZE = 3;
  const results: SubQuestionResult[] = [];
  
  for (let i = 0; i < subQuestions.length; i += BATCH_SIZE) {
    const batch = subQuestions.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (subQuestion, index) => {
      const globalIndex = i + index;
      const subStartTime = Date.now();
      
      try {
        const result = await processIndividualSubQuestionOptimized(
          subQuestion,
          context,
          effectiveDateFilter,
          strictDateEnforcement,
          useAllEntries
        );
        
        const subDuration = Date.now() - subStartTime;
        console.log(`[parallel-processor] Sub-question ${globalIndex + 1} completed in ${subDuration}ms`);
        
        return result;
      } catch (error) {
        console.error(`[parallel-processor] Error processing sub-question ${globalIndex + 1}:`, error);
        return {
          subQuestion: subQuestion.question,
          emotionResults: [],
          vectorResults: [],
          hasEntriesInDateRange: false,
          context: '',
          reasoning: 'Error processing sub-question',
          totalResults: 0
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  const totalDuration = Date.now() - startTime;
  console.log(`[parallel-processor] All ${subQuestions.length} sub-questions completed in ${totalDuration}ms (optimized parallel)`);
  
  return results;
}

async function processIndividualSubQuestionOptimized(
  subQuestion: any,
  context: ProcessingContext,
  effectiveDateFilter: any,
  strictDateEnforcement: boolean,
  useAllEntries: boolean = false
): Promise<SubQuestionResult> {
  const { validatedUserId, openaiApiKey, supabaseService } = context;
  
  console.log(`[parallel-processor] Processing optimized sub-question: "${subQuestion.question}"`);
  
  const searchPlan = subQuestion.searchPlan || {};
  const vectorSearch = searchPlan.vectorSearch || {};
  const sqlQueries = searchPlan.sqlQueries || [];
  
  const subQuestionEmotionResults = [];
  const subQuestionVectorResults = [];
  let hasEntriesInDateRange = true;

  // Override date filter if useAllEntries is true
  let actualDateFilter = effectiveDateFilter;
  if (useAllEntries) {
    console.log(`[parallel-processor] Using ALL entries - ignoring date filter`);
    actualDateFilter = null;
    strictDateEnforcement = false;
  }

  // Early date range check with connection pooling optimization
  if (actualDateFilter && strictDateEnforcement && !useAllEntries) {
    try {
      const { count: entriesInRange, error } = await supabaseService
        .from('Journal Entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', validatedUserId)
        .gte('created_at', actualDateFilter.startDate)
        .lte('created_at', actualDateFilter.endDate);

      if (error) {
        console.error(`[parallel-processor] Error checking date range:`, error);
      } else if (!entriesInRange || entriesInRange === 0) {
        console.log(`[parallel-processor] NO ENTRIES in date range`);
        hasEntriesInDateRange = false;
        return {
          subQuestion: subQuestion.question,
          emotionResults: [],
          vectorResults: [],
          hasEntriesInDateRange: false,
          context: '',
          reasoning: 'No entries found in specified date range',
          totalResults: 0
        };
      }
    } catch (error) {
      console.error(`[parallel-processor] Exception checking date range:`, error);
    }
  }

  // Create optimized promises for parallel execution
  const operationPromises = [];

  // Process SQL queries with connection pooling
  if (sqlQueries.length > 0) {
    operationPromises.push(
      processSQLQueriesOptimized(sqlQueries, {
        validatedUserId,
        effectiveDateFilter: actualDateFilter,
        supabaseService,
        subQuestion,
        useAllEntries
      })
    );
  }

  // Process vector search with caching
  if (vectorSearch.enabled) {
    operationPromises.push(
      processVectorSearchOptimized(vectorSearch, {
        validatedUserId,
        effectiveDateFilter: actualDateFilter,
        openaiApiKey,
        supabaseService,
        subQuestion,
        useAllEntries
      })
    );
  }

  // Execute all operations in parallel
  const operationResults = await Promise.all(operationPromises);

  // Merge results efficiently
  operationResults.forEach(result => {
    if (result.type === 'sql') {
      subQuestionEmotionResults.push(...result.emotionResults);
      subQuestionVectorResults.push(...result.vectorResults);
    } else if (result.type === 'vector') {
      subQuestionVectorResults.push(...result.vectorResults);
    }
  });

  // Generate optimized context
  const subQuestionContext = generateOptimizedContext(
    subQuestion,
    subQuestionEmotionResults,
    subQuestionVectorResults,
    useAllEntries
  );

  return {
    subQuestion: subQuestion.question,
    emotionResults: subQuestionEmotionResults,
    vectorResults: subQuestionVectorResults,
    hasEntriesInDateRange,
    context: subQuestionContext,
    reasoning: subQuestion.reasoning || (useAllEntries ? 'Comprehensive analysis completed' : 'Analysis completed'),
    totalResults: subQuestionEmotionResults.length + subQuestionVectorResults.length
  };
}

async function processSQLQueriesOptimized(sqlQueries: any[], context: any) {
  const { validatedUserId, effectiveDateFilter, supabaseService, subQuestion, useAllEntries } = context;
  const emotionResults = [];
  const vectorResults = [];
  
  console.log(`[parallel-processor] Executing ${sqlQueries.length} optimized SQL queries`);
  
  // Process SQL queries in parallel with connection reuse
  const sqlPromises = sqlQueries.map(async (sqlQuery) => {
    try {
      let sqlParams = { ...sqlQuery.parameters };
      
      if (useAllEntries) {
        sqlParams.start_date = null;
        sqlParams.end_date = null;
      } else if (effectiveDateFilter) {
        sqlParams.start_date = effectiveDateFilter.startDate;
        sqlParams.end_date = effectiveDateFilter.endDate;
      }
      
      // Optimized function calls with reduced parameters
      if (sqlQuery.function === 'get_top_emotions_with_entries') {
        const { data, error } = await supabaseService.rpc(sqlQuery.function, {
          user_id_param: validatedUserId,
          start_date: sqlParams.start_date,
          end_date: sqlParams.end_date,
          limit_count: Math.min(sqlParams.limit_count || 5, 3) // Reduce limit for faster processing
        });
        
        if (error) {
          console.error(`[parallel-processor] SQL function error:`, error);
          return [];
        }
        
        return (data || []).map((result, index) => ({
          ...result,
          source: 'emotion_analysis',
          query_function: sqlQuery.function,
          unique_key: `emotion_${result.emotion}_${index}_optimized`,
          sub_question: subQuestion.question,
          type: 'emotion',
          scope: useAllEntries ? 'all_entries' : 'date_filtered'
        }));
        
      } else if (sqlQuery.function === 'match_journal_entries_by_emotion') {
        const { data, error } = await supabaseService.rpc(sqlQuery.function, {
          emotion_name: sqlParams.emotion_name,
          user_id_filter: validatedUserId,
          min_score: Math.max(sqlParams.min_score || 0.3, 0.4), // Higher threshold for faster processing
          start_date: sqlParams.start_date,
          end_date: sqlParams.end_date,
          limit_count: Math.min(sqlParams.limit_count || 5, 3)
        });
        
        if (error) {
          console.error(`[parallel-processor] SQL function error:`, error);
          return [];
        }
        
        return (data || []).map(result => ({
          ...result,
          source: 'sql_query',
          query_function: sqlQuery.function,
          sub_question: subQuestion.question,
          type: 'vector',
          scope: useAllEntries ? 'all_entries' : 'date_filtered'
        }));
      }
      
      return [];
    } catch (error) {
      console.error(`[parallel-processor] Error executing optimized SQL query:`, error);
      return [];
    }
  });
  
  const sqlResults = await Promise.all(sqlPromises);
  
  // Efficiently separate results
  sqlResults.forEach(results => {
    results.forEach(result => {
      if (result.type === 'emotion') {
        emotionResults.push(result);
      } else if (result.type === 'vector') {
        vectorResults.push(result);
      }
    });
  });
  
  return { type: 'sql', emotionResults, vectorResults };
}

async function processVectorSearchOptimized(vectorSearch: any, context: any) {
  const { validatedUserId, effectiveDateFilter, openaiApiKey, supabaseService, subQuestion, useAllEntries } = context;
  
  try {
    console.log(`[parallel-processor] Executing optimized vector search`);
    
    // Use optimized embedding with caching
    const embedding = await OptimizedApiClient.getEmbedding(
      vectorSearch.query || subQuestion.question,
      openaiApiKey
    );

    let vectorSearchResults = [];
    const matchCount = useAllEntries ? 15 : 8; // Reduced match count for faster processing
    const threshold = Math.max(vectorSearch.threshold || 0.1, 0.2); // Higher threshold
    
    if (useAllEntries) {
      console.log('[parallel-processor] RPC match_journal_entries params:', { match_threshold: threshold, match_count: matchCount, user_id_filter: validatedUserId, query_embedding: '[omitted]' });
      const { data, error } = await supabaseService.rpc('match_journal_entries', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: matchCount,
        user_id_filter: validatedUserId
      });
      
      if (error) throw error;
      vectorSearchResults = data || [];
      
    } else if (effectiveDateFilter) {
      const { data, error } = await supabaseService.rpc('match_journal_entries_with_date', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: matchCount,
        user_id_filter: validatedUserId,
        start_date: effectiveDateFilter.startDate,
        end_date: effectiveDateFilter.endDate
      });
      
      if (error) throw error;
      vectorSearchResults = data || [];
      
    } else {
      console.log('[parallel-processor] RPC match_journal_entries params:', { match_threshold: threshold, match_count: matchCount, user_id_filter: validatedUserId, query_embedding: '[omitted]' });
      const { data, error } = await supabaseService.rpc('match_journal_entries', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: matchCount,
        user_id_filter: validatedUserId
      });
      
      if (error) throw error;
      vectorSearchResults = data || [];
    }

    console.log(`[parallel-processor] Optimized vector search returned ${vectorSearchResults.length} results`);

    const vectorResults = vectorSearchResults.map(result => ({
      ...result,
      source: 'vector_search_optimized',
      similarity: result.similarity,
      sub_question: subQuestion.question,
      scope: useAllEntries ? 'all_entries' : 'date_filtered'
    }));

    return { type: 'vector', vectorResults };

  } catch (error) {
    console.error(`[parallel-processor] Error in optimized vector search:`, error);
    return { type: 'vector', vectorResults: [] };
  }
}

function generateOptimizedContext(
  subQuestion: any,
  emotionResults: any[],
  vectorResults: any[],
  useAllEntries: boolean
): string {
  const isEmotionQuery = subQuestion.question.toLowerCase().includes('emotion') || emotionResults.length > 0;
  
  if (isEmotionQuery && emotionResults.length > 0) {
    let context = `**EMOTION ANALYSIS for "${subQuestion.question}":**\n\n`;
    context += "Pre-computed emotion scores (0.0-1.0 scale):\n\n";
    
    // Limit to top 3 emotions for faster processing
    emotionResults.slice(0, 3).forEach((result, index) => {
      const emotionName = result.emotion.toUpperCase();
      const score = parseFloat(result.score).toFixed(3);
      const frequency = result.sample_entries ? result.sample_entries.length : 0;
      
      context += `**${index + 1}. ${emotionName}** - Score: ${score}/1.0 (${frequency} entries)\n`;
      
      if (result.sample_entries && Array.isArray(result.sample_entries)) {
        // Limit to 1 sample entry for brevity
        const entry = result.sample_entries[0];
        if (entry) {
          const date = new Date(entry.created_at).toLocaleDateString();
          const preview = entry.content.substring(0, 80) + '...';
          context += `   Sample: ${date} - "${preview}"\n`;
        }
      }
      context += "\n";
    });
    
    return context;
  } else {
    // Standard formatting with limited context
    const allResults = [...emotionResults, ...vectorResults];
    
    if (allResults.length > 0) {
      let context = `**CONTEXT for "${subQuestion.question}":**\n\n`;
      
      if (useAllEntries) {
        context += `**SCOPE: Comprehensive analysis**\n\n`;
      }
      
      // Limit to top 3 results for performance
      context += allResults.slice(0, 3).map(entry => {
        const content = entry.content || entry.sample_entries?.[0]?.content || 'No content available';
        const date = entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'Unknown date';
        
        return `${date}: ${content.substring(0, 200)}...`;
      }).join('\n\n---\n\n');
      
      return context;
    }
  }
  
  return '';
}
