
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
  strictDateEnforcement: boolean
): Promise<SubQuestionResult[]> {
  console.log(`[parallel-processor] Processing ${subQuestions.length} sub-questions in parallel`);
  
  // Process all sub-questions simultaneously using Promise.all
  const startTime = Date.now();
  
  const subQuestionPromises = subQuestions.map(async (subQuestion, index) => {
    const subStartTime = Date.now();
    
    try {
      const result = await processIndividualSubQuestion(
        subQuestion,
        context,
        effectiveDateFilter,
        strictDateEnforcement
      );
      
      const subDuration = Date.now() - subStartTime;
      console.log(`[parallel-processor] Sub-question ${index + 1} completed in ${subDuration}ms`);
      
      return result;
    } catch (error) {
      console.error(`[parallel-processor] Error processing sub-question ${index + 1}:`, error);
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
  
  const results = await Promise.all(subQuestionPromises);
  const totalDuration = Date.now() - startTime;
  
  console.log(`[parallel-processor] All ${subQuestions.length} sub-questions completed in ${totalDuration}ms (parallel)`);
  
  return results;
}

async function processIndividualSubQuestion(
  subQuestion: any,
  context: ProcessingContext,
  effectiveDateFilter: any,
  strictDateEnforcement: boolean
): Promise<SubQuestionResult> {
  const { validatedUserId, openaiApiKey, supabaseService } = context;
  
  console.log(`[parallel-processor] Processing sub-question: "${subQuestion.question}"`);
  
  const searchPlan = subQuestion.searchPlan || {};
  const vectorSearch = searchPlan.vectorSearch || {};
  const sqlQueries = searchPlan.sqlQueries || [];
  
  // Individual containers for this sub-question
  const subQuestionEmotionResults = [];
  const subQuestionVectorResults = [];
  let hasEntriesInDateRange = true;

  // Check if we have entries in the date range for temporal queries
  if (effectiveDateFilter && strictDateEnforcement) {
    console.log(`[parallel-processor] Checking entries in date range for sub-question: ${effectiveDateFilter.startDate} to ${effectiveDateFilter.endDate}`);
    
    try {
      const { count: entriesInRange, error } = await supabaseService
        .from('Journal Entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', validatedUserId)
        .gte('created_at', effectiveDateFilter.startDate)
        .lte('created_at', effectiveDateFilter.endDate);

      if (error) {
        console.error(`[parallel-processor] Error checking date range:`, error);
      } else {
        console.log(`[parallel-processor] Found ${entriesInRange || 0} entries in date range for sub-question`);
        
        if (!entriesInRange || entriesInRange === 0) {
          console.log(`[parallel-processor] NO ENTRIES in date range for this sub-question`);
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
      }
    } catch (error) {
      console.error(`[parallel-processor] Exception checking date range:`, error);
    }
  }

  // Create promises for SQL queries and vector search to run in parallel
  const operationPromises = [];

  // Execute SQL queries
  if (sqlQueries.length > 0) {
    operationPromises.push(
      processSQLQueries(sqlQueries, {
        validatedUserId,
        effectiveDateFilter,
        supabaseService,
        subQuestion
      })
    );
  }

  // Execute vector search
  if (vectorSearch.enabled) {
    operationPromises.push(
      processVectorSearch(vectorSearch, {
        validatedUserId,
        effectiveDateFilter,
        openaiApiKey,
        supabaseService,
        subQuestion
      })
    );
  }

  // Wait for all operations to complete
  const operationResults = await Promise.all(operationPromises);

  // Merge results
  operationResults.forEach(result => {
    if (result.type === 'sql') {
      subQuestionEmotionResults.push(...result.emotionResults);
      subQuestionVectorResults.push(...result.vectorResults);
    } else if (result.type === 'vector') {
      subQuestionVectorResults.push(...result.vectorResults);
    }
  });

  // Prepare context for this specific sub-question
  let subQuestionContext = '';
  
  // Check if this sub-question is emotion-focused
  const isEmotionQuery = subQuestion.question.toLowerCase().includes('emotion') || subQuestionEmotionResults.length > 0;
  
  if (isEmotionQuery && subQuestionEmotionResults.length > 0) {
    // Enhanced emotion data formatting for this sub-question
    subQuestionContext = `**EMOTION ANALYSIS for "${subQuestion.question}":**\n\n`;
    subQuestionContext += "Pre-computed emotion scores (0.0-1.0 scale) from AI analysis:\n\n";
    
    subQuestionEmotionResults.forEach((result, index) => {
      const emotionName = result.emotion.toUpperCase();
      const score = parseFloat(result.score).toFixed(3);
      const frequency = result.sample_entries ? result.sample_entries.length : 0;
      
      subQuestionContext += `**${index + 1}. ${emotionName}**\n`;
      subQuestionContext += `   • Score: ${score}/1.0\n`;
      subQuestionContext += `   • Frequency: Found in ${frequency} entries\n`;
      
      if (result.sample_entries && Array.isArray(result.sample_entries)) {
        subQuestionContext += `   • Sample entries with this emotion:\n`;
        result.sample_entries.slice(0, 2).forEach((entry, entryIndex) => {
          const date = new Date(entry.created_at).toLocaleDateString();
          const preview = entry.content.substring(0, 100) + (entry.content.length > 100 ? '...' : '');
          subQuestionContext += `     ${entryIndex + 1}. ${date}: "${preview}" (Score: ${entry.score})\n`;
        });
      }
      subQuestionContext += "\n";
    });
    
    // Add supporting vector search results
    if (subQuestionVectorResults.length > 0) {
      subQuestionContext += "\n**SUPPORTING CONTEXT:**\n";
      subQuestionVectorResults.slice(0, 3).forEach((entry, index) => {
        const date = new Date(entry.created_at).toLocaleDateString();
        const preview = entry.content.substring(0, 150) + (entry.content.length > 150 ? '...' : '');
        subQuestionContext += `${index + 1}. ${date}: ${preview}\n`;
      });
    }
  } else {
    // Standard formatting for non-emotion sub-questions
    const allSubQuestionResults = [...subQuestionEmotionResults, ...subQuestionVectorResults];
    
    if (allSubQuestionResults.length > 0) {
      subQuestionContext = `**CONTEXT for "${subQuestion.question}":**\n\n`;
      subQuestionContext += allSubQuestionResults.map(entry => {
        const content = entry.content || entry.sample_entries?.[0]?.content || 'No content available';
        const date = entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'Unknown date';
        const emotions = entry.emotions ? Object.keys(entry.emotions).slice(0, 3).join(', ') : 'No emotions detected';
        
        return `Date: ${date}\nContent: ${content.substring(0, 300)}...\nEmotions: ${emotions}`;
      }).join('\n\n---\n\n');
    }
  }

  return {
    subQuestion: subQuestion.question,
    emotionResults: subQuestionEmotionResults,
    vectorResults: subQuestionVectorResults,
    hasEntriesInDateRange,
    context: subQuestionContext,
    reasoning: subQuestion.reasoning || 'Analysis completed',
    totalResults: subQuestionEmotionResults.length + subQuestionVectorResults.length
  };
}

async function processSQLQueries(sqlQueries: any[], context: any) {
  const { validatedUserId, effectiveDateFilter, supabaseService, subQuestion } = context;
  const emotionResults = [];
  const vectorResults = [];
  
  console.log(`[parallel-processor] Executing ${sqlQueries.length} SQL queries for sub-question`);
  
  // Process SQL queries in parallel
  const sqlPromises = sqlQueries.map(async (sqlQuery) => {
    try {
      let sqlParams = { ...sqlQuery.parameters };
      
      if (effectiveDateFilter) {
        sqlParams.start_date = effectiveDateFilter.startDate;
        sqlParams.end_date = effectiveDateFilter.endDate;
      }
      
      if (sqlQuery.function === 'get_top_emotions_with_entries') {
        console.log(`[parallel-processor] Calling get_top_emotions_with_entries for sub-question with params:`, {
          user_id_param: validatedUserId,
          start_date: sqlParams.start_date,
          end_date: sqlParams.end_date,
          limit_count: sqlParams.limit_count || 5
        });

        const { data, error } = await supabaseService.rpc(sqlQuery.function, {
          user_id_param: validatedUserId,
          start_date: sqlParams.start_date,
          end_date: sqlParams.end_date,
          limit_count: sqlParams.limit_count || 5
        });
        
        if (error) {
          console.error(`[parallel-processor] SQL function error for ${sqlQuery.function}:`, error);
          throw error;
        }
        
        const queryResult = data || [];
        console.log(`[parallel-processor] SQL function ${sqlQuery.function} returned ${queryResult.length} results for sub-question`);
        
        return queryResult.map((result, index) => ({
          ...result,
          source: 'emotion_analysis',
          query_function: sqlQuery.function,
          unique_key: `emotion_${result.emotion}_${index}_${subQuestion.question}`,
          sub_question: subQuestion.question,
          type: 'emotion'
        }));
        
      } else if (sqlQuery.function === 'match_journal_entries_by_emotion') {
        console.log(`[parallel-processor] Calling match_journal_entries_by_emotion for sub-question`);

        const { data, error } = await supabaseService.rpc(sqlQuery.function, {
          emotion_name: sqlParams.emotion_name,
          user_id_filter: validatedUserId,
          min_score: sqlParams.min_score || 0.3,
          start_date: sqlParams.start_date,
          end_date: sqlParams.end_date,
          limit_count: sqlParams.limit_count || 5
        });
        
        if (error) {
          console.error(`[parallel-processor] SQL function error for ${sqlQuery.function}:`, error);
          throw error;
        }
        
        const queryResult = data || [];
        console.log(`[parallel-processor] SQL function ${sqlQuery.function} returned ${queryResult.length} results for sub-question`);
        
        return queryResult.map(result => ({
          ...result,
          source: 'sql_query',
          query_function: sqlQuery.function,
          sub_question: subQuestion.question,
          type: 'vector'
        }));
      }
      
      return [];
    } catch (error) {
      console.error(`[parallel-processor] Error executing SQL query ${sqlQuery.function} for sub-question:`, error);
      return [];
    }
  });
  
  const sqlResults = await Promise.all(sqlPromises);
  
  // Separate emotion and vector results
  sqlResults.forEach(results => {
    results.forEach(result => {
      if (result.type === 'emotion') {
        emotionResults.push(result);
      } else if (result.type === 'vector') {
        vectorResults.push(result);
      }
    });
  });
  
  return {
    type: 'sql',
    emotionResults,
    vectorResults
  };
}

async function processVectorSearch(vectorSearch: any, context: any) {
  const { validatedUserId, effectiveDateFilter, openaiApiKey, supabaseService, subQuestion } = context;
  
  try {
    console.log(`[parallel-processor] Executing vector search for sub-question: "${vectorSearch.query || subQuestion.question}"`);
    
    // Generate embedding for the search query
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: vectorSearch.query || subQuestion.question,
        model: 'text-embedding-ada-002',
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    // Perform vector search with service client
    let vectorSearchResults = [];
    
    if (effectiveDateFilter) {
      console.log(`[parallel-processor] Vector search with date filter for sub-question`);
      const { data, error } = await supabaseService.rpc('match_journal_entries_with_date', {
        query_embedding: embedding,
        match_threshold: vectorSearch.threshold || 0.1,
        match_count: 10,
        user_id_filter: validatedUserId,
        start_date: effectiveDateFilter.startDate,
        end_date: effectiveDateFilter.endDate
      });
      
      if (error) {
        console.error(`[parallel-processor] Vector search with date error for sub-question:`, error);
        throw error;
      }
      vectorSearchResults = data || [];
      
    } else {
      console.log(`[parallel-processor] Vector search without date filter for sub-question`);
      const { data, error } = await supabaseService.rpc('match_journal_entries_fixed', {
        query_embedding: embedding,
        match_threshold: vectorSearch.threshold || 0.1,
        match_count: 10,
        user_id_filter: validatedUserId
      });
      
      if (error) {
        console.error(`[parallel-processor] Vector search error for sub-question:`, error);
        throw error;
      }
      vectorSearchResults = data || [];
    }

    console.log(`[parallel-processor] Vector search returned ${vectorSearchResults.length} results for sub-question`);

    const vectorResults = vectorSearchResults.map(result => ({
      ...result,
      source: 'vector_search',
      similarity: result.similarity,
      sub_question: subQuestion.question
    }));

    return {
      type: 'vector',
      vectorResults
    };

  } catch (error) {
    console.error(`[parallel-processor] Error in vector search for sub-question:`, error);
    return {
      type: 'vector',
      vectorResults: []
    };
  }
}
