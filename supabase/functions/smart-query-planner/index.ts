import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { 
  generateDatabaseSchemaContext, 
  getEmotionAnalysisGuidelines, 
  getThemeAnalysisGuidelines 
} from '../_shared/databaseSchemaContext.ts';
import { executeSQLAnalysis, executeBasicSQLQuery } from './sqlExecution.ts';
import { validateAndSanitizeSQL } from './sqlValidation.ts';
import { getEnhancedSQLConstraints } from './promptConstraints.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueryPlan {
  strategy: string;
  searchMethods: string[];
  filters: any;
  emotionFocus?: string;
  timeRange?: any;
  subQuestions?: SubQuestion[];
  expectedResponseType: string;
  confidence: number;
  reasoning: string;
  databaseContext: string;
}

interface SubQuestion {
  id?: string;
  question: string;
  purpose: string;
  searchStrategy: string;
  executionStage: number;
  dependencies?: string[];
  resultForwarding?: string;
  executionMode?: 'parallel' | 'sequential' | 'conditional';
  analysisSteps: AnalysisStep[];
}

interface AnalysisStep {
  step: number;
  description: string;
  queryType: string;
  sqlQueryType?: 'filtering' | 'analysis';
  sqlQuery?: string;
  vectorSearch?: {
    query: string;
    threshold: number;
    limit: number;
  };
  timeRange?: any;
  resultContext?: string;
  dependencies?: string[];
}

interface ExecutionContext {
  stageResults: Map<string, any>;
  subQuestionResults: Map<string, any>;
  currentStage: number;
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

async function testVectorOperations(supabaseClient: any, requestId: string): Promise<boolean> {
  try {
    console.log(`[${requestId}] Testing vector operations...`);
    
    const { data, error } = await supabaseClient.rpc('test_vector_operations');
    
    if (error) {
      console.error(`[${requestId}] Vector test error:`, error);
      return false;
    }
    
    if (data && data.success) {
      console.log(`[${requestId}] Vector operations test passed:`, data.message);
      return true;
    } else {
      console.error(`[${requestId}] Vector operations test failed:`, data?.error || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error(`[${requestId}] Error testing vector operations:`, error);
    return false;
  }
}

async function executePlan(plan: any, userId: string, supabaseClient: any, requestId: string, userTimezone: string = 'UTC') {
  console.log(`[${requestId}] Executing orchestrated plan:`, JSON.stringify(plan, null, 2));

  // Initialize execution context
  const executionContext: ExecutionContext = {
    stageResults: new Map(),
    subQuestionResults: new Map(),
    currentStage: 1
  };

  // Assign IDs to sub-questions if not present
  plan.subQuestions.forEach((subQ: any, index: number) => {
    if (!subQ.id) {
      subQ.id = `sq${index + 1}`;
    }
  });

  // Get total entries count for percentage calculations
  const { count: totalEntries } = await supabaseClient
    .from('Journal Entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  // Group sub-questions by execution stage
  const stageGroups = groupByExecutionStage(plan.subQuestions);
  console.log(`[${requestId}] Execution stages:`, Object.keys(stageGroups).map(k => `Stage ${k}: ${stageGroups[k].length} sub-questions`));

  const allResults = [];

  // Execute stages sequentially
  for (const stage of Object.keys(stageGroups).sort((a, b) => parseInt(a) - parseInt(b))) {
    console.log(`[${requestId}] Executing stage ${stage} with ${stageGroups[stage].length} sub-questions`);
    executionContext.currentStage = parseInt(stage);

    // Execute sub-questions in parallel within the stage (if they're independent)
    const stageResults = await executeStageInParallel(stageGroups[stage], userId, supabaseClient, requestId, executionContext, userTimezone);
    
    // Store stage results for dependency resolution
    executionContext.stageResults.set(stage, stageResults);
    
    // Store individual sub-question results
    stageResults.forEach((result: any) => {
      if (result.subQuestion?.id) {
        executionContext.subQuestionResults.set(result.subQuestion.id, result);
      }
    });

    allResults.push(...stageResults);
  }

  console.log(`[${requestId}] Orchestrated execution complete. Total results: ${allResults.length}`);
  
  // ENHANCED RESULT PROCESSING: Transform raw data into processed summaries
  const processedResults = await processExecutionResults(allResults, userId, totalEntries || 0, requestId);
  
  return processedResults;
}

/**
 * NEW: Enhanced result processing to convert raw SQL/vector data into meaningful summaries
 */
async function processExecutionResults(allResults: any[], userId: string, totalEntries: number, requestId: string) {
  console.log(`[${requestId}] Processing ${allResults.length} sub-question results with total entries context: ${totalEntries}`);
  
  const processedResults = [];
  
  for (const result of allResults) {
    const processedResult = {
      subQuestion: result.subQuestion,
      executionSummary: {
        resultType: 'unknown',
        dataType: 'none',
        summary: '',
        count: 0,
        analysis: {},
        sampleEntries: [],
        totalEntriesContext: totalEntries
      },
      executionDetails: result.executionResults
    };

    // Extract step type from the first analysis step
    const firstStep = result.subQuestion?.analysisSteps?.[0];
    const sqlQueryType = firstStep?.sqlQueryType;
    
    if (result.executionResults?.sqlResults?.length > 0) {
      const sqlResults = result.executionResults.sqlResults;
      
      if (sqlQueryType === 'analysis') {
        // ANALYSIS QUERIES: Process computed statistics
        processedResult.executionSummary = await processAnalysisResults(sqlResults, totalEntries, requestId);
      } else if (sqlQueryType === 'filtering') {
        // FILTERING QUERIES: Count and sample entries
        processedResult.executionSummary = await processFilteringResults(sqlResults, totalEntries, requestId);
      } else {
        // UNKNOWN SQL TYPE: Determine based on content
        processedResult.executionSummary = await autoDetectSQLResultType(sqlResults, totalEntries, requestId);
      }
    } else if (result.executionResults?.vectorResults?.length > 0) {
      // VECTOR SEARCH: Sample entries with semantic relevance
      processedResult.executionSummary = await processVectorResults(result.executionResults.vectorResults, totalEntries, requestId);
    } else {
      // NO RESULTS
      processedResult.executionSummary = {
        resultType: 'no_results',
        dataType: 'none',
        summary: 'No matching entries found',
        count: 0,
        analysis: {},
        sampleEntries: [],
        totalEntriesContext: totalEntries
      };
    }

    processedResults.push(processedResult);
  }
  
  console.log(`[${requestId}] Result processing complete. Processed ${processedResults.length} sub-questions`);
  return processedResults;
}

/**
 * Process SQL analysis results (COUNT, AVG, SUM, etc.)
 */
async function processAnalysisResults(sqlResults: any[], totalEntries: number, requestId: string) {
  console.log(`[${requestId}] Processing analysis results: ${sqlResults.length} rows`);
  console.log(`[${requestId}] Sample SQL result structure:`, JSON.stringify(sqlResults[0], null, 2));
  
  // Check for count queries - multiple variations
  if (sqlResults.length === 1 && (
    sqlResults[0].total_entries !== undefined || 
    sqlResults[0].count !== undefined ||
    sqlResults[0].entry_count !== undefined
  )) {
    const totalCount = sqlResults[0].total_entries || sqlResults[0].count || sqlResults[0].entry_count;
    return {
      resultType: 'count_analysis',
      dataType: 'count',
      summary: `Found ${totalCount} matching journal entries`,
      count: totalCount,
      analysis: { totalEntries: totalCount },
      sampleEntries: [],
      totalEntriesContext: totalEntries
    };
  }

  // Enhanced emotion analysis detection - check for common emotion-related fields
  if (sqlResults.some(row => 
    row.emotion !== undefined || 
    row.avg_sentiment !== undefined || 
    row.score !== undefined ||
    row.avg_score !== undefined ||
    Object.keys(row).some(key => key.toLowerCase().includes('emotion'))
  )) {
    const emotionAnalysis = {};
    let emotionCount = 0;
    
    sqlResults.forEach(row => {
      // Handle emotion score results
      if (row.emotion && (row.score !== undefined || row.avg_score !== undefined)) {
        const score = row.score || row.avg_score;
        emotionAnalysis[row.emotion] = {
          score: parseFloat(score).toFixed(2),
          occurrences: row.entry_count || row.count || 1
        };
        emotionCount++;
      }
      // Handle monthly sentiment
      else if (row.month && row.avg_sentiment !== undefined) {
        emotionAnalysis[row.month] = {
          averageSentiment: parseFloat(row.avg_sentiment).toFixed(2),
          entryCount: row.entry_count || 0
        };
        emotionCount++;
      }
      // Handle any other emotion-related field
      else {
        Object.keys(row).forEach(key => {
          if (key.toLowerCase().includes('emotion') && row[key] !== undefined) {
            emotionAnalysis[key] = row[key];
            emotionCount++;
          }
        });
      }
    });
    
    const summary = Object.keys(emotionAnalysis).length > 0 
      ? `Emotion analysis: ${Object.entries(emotionAnalysis).slice(0, 3).map(([emotion, data]: [string, any]) => 
          `${emotion}${data.score ? ` (${data.score})` : ''}`).join(', ')}`
      : `Emotion analysis completed with ${sqlResults.length} data points`;
    
    return {
      resultType: 'emotion_analysis',
      dataType: 'emotions',
      summary,
      count: sqlResults.length,
      analysis: emotionAnalysis,
      sampleEntries: [],
      totalEntriesContext: totalEntries
    };
  }

  // Enhanced theme analysis detection
  if (sqlResults.some(row => 
    row.theme !== undefined || 
    row.master_theme !== undefined ||
    Object.keys(row).some(key => key.toLowerCase().includes('theme'))
  )) {
    const themeAnalysis = {};
    
    sqlResults.forEach(row => {
      if (row.theme && (row.entry_count !== undefined || row.count !== undefined)) {
        const count = row.entry_count || row.count;
        themeAnalysis[row.theme] = {
          count: count,
          percentage: totalEntries > 0 ? ((count / totalEntries) * 100).toFixed(1) : '0'
        };
      } else if (row.master_theme) {
        themeAnalysis[row.master_theme] = row.entry_count || row.count || 1;
      }
    });
    
    const summary = Object.keys(themeAnalysis).length > 0 
      ? `Theme analysis: ${Object.entries(themeAnalysis).slice(0, 3).map(([theme, data]: [string, any]) => 
          `${theme}${data.count ? ` (${data.count} entries)` : ''}`).join(', ')}`
      : `Theme analysis completed with ${sqlResults.length} themes`;
    
    return {
      resultType: 'theme_analysis',
      dataType: 'themes',
      summary,
      count: sqlResults.length,
      analysis: themeAnalysis,
      sampleEntries: [],
      totalEntriesContext: totalEntries
    };
  }
  
  // Check for percentage/distribution queries
  if (sqlResults.some(row => row.percentage !== undefined || row.entry_count !== undefined)) {
    const distributionAnalysis = {};
    
    sqlResults.forEach(row => {
      if (row.bucket && row.entry_count !== undefined) {
        distributionAnalysis[row.bucket] = {
          count: row.entry_count,
          percentage: row.percentage || ((row.entry_count / totalEntries) * 100).toFixed(1)
        };
      }
    });
    
    const summary = `Distribution analysis: ${Object.entries(distributionAnalysis)
      .map(([bucket, data]: [string, any]) => `${bucket}: ${data.count} entries (${data.percentage}%)`)
      .join(', ')}`;
    
    return {
      resultType: 'distribution_analysis',
      dataType: 'percentages',
      summary,
      count: sqlResults.reduce((sum, row) => sum + (row.entry_count || 0), 0),
      analysis: distributionAnalysis,
      sampleEntries: [],
      totalEntriesContext: totalEntries
    };
  }
  
  // Enhanced generic analysis - extract any meaningful data from SQL results
  const genericAnalysis = {};
  let meaningfulFieldsFound = 0;
  
  sqlResults.forEach((row, index) => {
    Object.keys(row).forEach(key => {
      // Skip common metadata fields
      if (!['id', 'created_at', 'updated_at', 'user_id'].includes(key.toLowerCase())) {
        if (!genericAnalysis[key]) {
          genericAnalysis[key] = [];
        }
        genericAnalysis[key].push(row[key]);
        meaningfulFieldsFound++;
      }
    });
  });
  
  const summary = meaningfulFieldsFound > 0 
    ? `Analysis completed with ${Object.keys(genericAnalysis).length} data categories from ${sqlResults.length} results`
    : `Statistical analysis computed with ${sqlResults.length} data points`;
  
  return {
    resultType: 'statistical_analysis',
    dataType: 'statistics',
    summary,
    count: sqlResults.length,
    analysis: meaningfulFieldsFound > 0 ? genericAnalysis : { rawResults: sqlResults.slice(0, 5) },
    sampleEntries: [],
    totalEntriesContext: totalEntries
  };
}

/**
 * Process SQL filtering results (entries matching criteria)
 */
async function processFilteringResults(sqlResults: any[], totalEntries: number, requestId: string) {
  console.log(`[${requestId}] Processing filtering results: ${sqlResults.length} entries found`);
  
  if (sqlResults.length === 0) {
    return {
      resultType: 'no_entries_found',
      dataType: 'entries',
      summary: `No entries found matching the specified criteria`,
      count: 0,
      analysis: { 
        matchedEntries: 0,
        totalEntries,
        percentage: 0
      },
      sampleEntries: [],
      totalEntriesContext: totalEntries
    };
  }
  
  const sampleEntries = sqlResults.slice(0, 3).map(entry => ({
    id: entry.id,
    content: entry.content || entry['refined text'] || entry['transcription text'] || 'No content available',
    created_at: entry.created_at,
    themes: entry.master_themes || entry.themes || [],
    emotions: entry.emotions || {},
    sentiment: entry.sentiment
  }));
  
  const percentage = totalEntries > 0 ? ((sqlResults.length / totalEntries) * 100).toFixed(1) : '0';
  
  // Extract themes and emotions from the filtered entries for analysis
  const themeFrequency = {};
  const emotionFrequency = {};
  
  sqlResults.forEach(entry => {
    // Count themes
    if (entry.master_themes && Array.isArray(entry.master_themes)) {
      entry.master_themes.forEach(theme => {
        themeFrequency[theme] = (themeFrequency[theme] || 0) + 1;
      });
    }
    
    // Count emotions
    if (entry.emotions && typeof entry.emotions === 'object') {
      Object.keys(entry.emotions).forEach(emotion => {
        emotionFrequency[emotion] = (emotionFrequency[emotion] || 0) + 1;
      });
    }
  });
  
  return {
    resultType: 'filtered_entries',
    dataType: 'entries',
    summary: `Found ${sqlResults.length} matching entries (${percentage}% of total ${totalEntries} entries)`,
    count: sqlResults.length,
    analysis: { 
      matchedEntries: sqlResults.length,
      totalEntries,
      percentage: parseFloat(percentage),
      commonThemes: Object.entries(themeFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([theme, count]) => ({ theme, count })),
      commonEmotions: Object.entries(emotionFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([emotion, count]) => ({ emotion, count }))
    },
    sampleEntries,
    totalEntriesContext: totalEntries
  };
}

/**
 * Process vector search results
 */
async function processVectorResults(vectorResults: any[], totalEntries: number, requestId: string) {
  console.log(`[${requestId}] Processing vector results: ${vectorResults.length} entries found`);
  
  const sampleEntries = vectorResults.slice(0, 3).map(entry => ({
    id: entry.id,
    content: entry.content || 'No content available',
    created_at: entry.created_at,
    similarity: entry.similarity || 0,
    themes: entry.themes || [],
    emotions: entry.emotions || {}
  }));
  
  const avgSimilarity = vectorResults.length > 0 
    ? (vectorResults.reduce((sum, r) => sum + (r.similarity || 0), 0) / vectorResults.length).toFixed(3)
    : '0';
  
  return {
    resultType: 'semantic_search',
    dataType: 'entries',
    summary: `Found ${vectorResults.length} semantically relevant entries (avg similarity: ${avgSimilarity})`,
    count: vectorResults.length,
    analysis: { 
      averageSimilarity: parseFloat(avgSimilarity),
      resultCount: vectorResults.length
    },
    sampleEntries,
    totalEntriesContext: totalEntries
  };
}

/**
 * Auto-detect SQL result type when not explicitly specified
 */
async function autoDetectSQLResultType(sqlResults: any[], totalEntries: number, requestId: string) {
  // Check if it looks like analysis data (has aggregated fields)
  const hasAggregateFields = sqlResults.some(row => 
    row.avg_sentiment !== undefined || 
    row.entry_count !== undefined || 
    row.total_entries !== undefined ||
    row.percentage !== undefined
  );
  
  if (hasAggregateFields) {
    return await processAnalysisResults(sqlResults, totalEntries, requestId);
  } else {
    return await processFilteringResults(sqlResults, totalEntries, requestId);
  }
}

function groupByExecutionStage(subQuestions: SubQuestion[]): { [stage: number]: SubQuestion[] } {
  const groups: { [stage: number]: SubQuestion[] } = {};
  
  subQuestions.forEach(subQ => {
    const stage = subQ.executionStage || 1;
    if (!groups[stage]) {
      groups[stage] = [];
    }
    groups[stage].push(subQ);
  });

  return groups;
}

async function executeStageInParallel(
  subQuestions: SubQuestion[], 
  userId: string, 
  supabaseClient: any, 
  requestId: string, 
  executionContext: ExecutionContext,
  userTimezone: string = 'UTC'
) {
  // Check for dependencies within the stage
  const independentQuestions = subQuestions.filter(sq => !sq.dependencies || sq.dependencies.length === 0);
  const dependentQuestions = subQuestions.filter(sq => sq.dependencies && sq.dependencies.length > 0);

  console.log(`[${requestId}] Stage execution - Independent: ${independentQuestions.length}, Dependent: ${dependentQuestions.length}`);

  const results = [];

  // Execute independent questions in parallel
  if (independentQuestions.length > 0) {
    const independentResults = await Promise.all(
      independentQuestions.map(subQ => executeSubQuestion(subQ, userId, supabaseClient, requestId, executionContext, userTimezone))
    );
    results.push(...independentResults);

    // Update context with independent results
    independentResults.forEach(result => {
      if (result.subQuestion?.id) {
        executionContext.subQuestionResults.set(result.subQuestion.id, result);
      }
    });
  }

  // Execute dependent questions sequentially (they might depend on results from independent ones)
  for (const subQ of dependentQuestions) {
    console.log(`[${requestId}] Executing dependent sub-question: ${subQ.id} with dependencies: ${subQ.dependencies?.join(', ')}`);
    const dependentResult = await executeSubQuestion(subQ, userId, supabaseClient, requestId, executionContext, userTimezone);
    results.push(dependentResult);
    
    // Update context
    if (dependentResult.subQuestion?.id) {
      executionContext.subQuestionResults.set(dependentResult.subQuestion.id, dependentResult);
    }
  }

  return results;
}

async function executeSubQuestion(
  subQuestion: SubQuestion, 
  userId: string, 
  supabaseClient: any, 
  requestId: string, 
  executionContext: ExecutionContext,
  userTimezone: string = 'UTC'
) {
  console.log(`[${requestId}] Executing sub-question: ${subQuestion.id} - ${subQuestion.question}`);

  const subResults = {
    subQuestion: subQuestion,
    researcherOutput: null,
    executionResults: {
      sqlResults: [],
      vectorResults: [],
      analysisResults: [], // NEW: Store computed analysis results separately
      error: null,
      dependencyContext: {},
      sqlExecutionDetails: {
        originalQuery: null,
        sanitizedQuery: null,
        validationResult: null,
        executionError: null,
        fallbackUsed: false,
        queryType: null // Track whether this was filtering or analysis
      },
      vectorExecutionDetails: {
        testPassed: false,
        executionError: null,
        fallbackUsed: false
      }
    }
  };

  try {
    // Process dependency context if needed
    if (subQuestion.dependencies && subQuestion.dependencies.length > 0) {
      console.log(`[${requestId}] Processing dependencies: ${subQuestion.dependencies.join(', ')}`);
      for (const depId of subQuestion.dependencies) {
        const depResult = executionContext.subQuestionResults.get(depId);
        if (depResult) {
          subResults.executionResults.dependencyContext[depId] = depResult.executionResults;
        }
      }
    }

    // Execute each analysis step
    for (const step of subQuestion.analysisSteps) {
      console.log(`[${requestId}] Executing step ${step.step}: ${step.description}`);
      
      if (step.sqlQuery) {
        // SQL Execution
        const sqlResult = await executeSQLAnalysis(step, userId, supabaseClient, requestId, subResults.executionResults.sqlExecutionDetails, userTimezone);
        
        if (sqlResult && Array.isArray(sqlResult)) {
          subResults.executionResults.sqlResults.push(...sqlResult);
        }
      }
      
      if (step.vectorSearch) {
        // Vector Search Execution
        try {
          const vectorTestPassed = await testVectorOperations(supabaseClient, requestId);
          subResults.executionResults.vectorExecutionDetails.testPassed = vectorTestPassed;
          
          if (vectorTestPassed) {
            const vectorResult = await executeVectorSearch(step.vectorSearch, userId, supabaseClient, requestId, step.timeRange, userTimezone);
            if (vectorResult && Array.isArray(vectorResult)) {
              subResults.executionResults.vectorResults.push(...vectorResult);
            }
          } else {
            console.warn(`[${requestId}] Vector operations test failed, skipping vector search for step ${step.step}`);
            subResults.executionResults.vectorExecutionDetails.fallbackUsed = true;
            
            // Fallback to basic SQL if vector fails
            const fallbackResults = await executeBasicSQLQuery(userId, supabaseClient, requestId);
            if (fallbackResults && Array.isArray(fallbackResults)) {
              subResults.executionResults.sqlResults.push(...fallbackResults);
            }
          }
        } catch (vectorError) {
          console.error(`[${requestId}] Vector search error:`, vectorError);
          subResults.executionResults.vectorExecutionDetails.executionError = vectorError.message;
          subResults.executionResults.vectorExecutionDetails.fallbackUsed = true;
          
          // Fallback to basic SQL if vector fails
          const fallbackResults = await executeBasicSQLQuery(userId, supabaseClient, requestId);
          if (fallbackResults && Array.isArray(fallbackResults)) {
            subResults.executionResults.sqlResults.push(...fallbackResults);
          }
        }
      }
    }

    console.log(`[${requestId}] Sub-question execution complete. SQL results: ${subResults.executionResults.sqlResults.length}, Vector results: ${subResults.executionResults.vectorResults.length}`);

  } catch (error) {
    console.error(`[${requestId}] Error executing sub-question:`, error);
    subResults.executionResults.error = error.message;
    
    // Fallback execution
    try {
      const fallbackResults = await executeBasicSQLQuery(userId, supabaseClient, requestId);
      if (fallbackResults && Array.isArray(fallbackResults)) {
        subResults.executionResults.sqlResults.push(...fallbackResults);
      }
    } catch (fallbackError) {
      console.error(`[${requestId}] Fallback execution also failed:`, fallbackError);
    }
  }

  return subResults;
}

async function executeVectorSearch(
  vectorSearch: any, 
  userId: string, 
  supabaseClient: any, 
  requestId: string,
  timeRange: any = null,
  userTimezone: string = 'UTC'
) {
  console.log(`[${requestId}] Executing vector search: "${vectorSearch.query}"`);
  
  try {
    // Generate embedding for the search query
    const embedding = await generateEmbedding(vectorSearch.query);
    
    let vectorResults;
    
    // Try with time range if available
    if (timeRange && (timeRange.start || timeRange.end)) {
      console.log(`[${requestId}] Vector search with time range: ${timeRange.start} to ${timeRange.end}`);
      const { data, error } = await supabaseClient.rpc('match_journal_entries_with_date', {
        query_embedding: embedding,
        match_threshold: vectorSearch.threshold || 0.3,
        match_count: vectorSearch.limit || 15,
        user_id_filter: userId,
        start_date: timeRange.start || null,
        end_date: timeRange.end || null
      });

      if (error) {
        console.error(`[${requestId}] Time-filtered vector search error:`, error);
        throw error;
      }
      
      vectorResults = data;
    } else {
      // Basic vector search without time constraints
      console.log(`[${requestId}] Vector search without time constraints`);
      const { data, error } = await supabaseClient.rpc('match_journal_entries', {
        query_embedding: embedding,
        match_threshold: vectorSearch.threshold || 0.3,
        match_count: vectorSearch.limit || 15,
        user_id_filter: userId
      });

      if (error) {
        console.error(`[${requestId}] Basic vector search error:`, error);
        throw error;
      }
      
      vectorResults = data;
    }

    console.log(`[${requestId}] Vector search successful, found ${vectorResults?.length || 0} results`);
    return vectorResults || [];

  } catch (error) {
    console.error(`[${requestId}] Error in vector search:`, error);
    throw error;
  }
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
      model: 'text-embedding-3-small', // Use same model as journal embeddings
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Simplified Query Planning - No hardcoded patterns, just pure OpenAI execution
 */
async function analyzeQueryWithSubQuestions(message, conversationContext, userEntryCount, isFollowUp = false, supabaseClient, userTimezone = 'UTC') {
  try {
    const last = Array.isArray(conversationContext) ? conversationContext.slice(-6) : [];
    
    console.log(`[Query Planner] Processing query with user timezone: ${userTimezone}`);
    
    // Get live database schema with real themes and emotions using the authenticated client
    const databaseSchemaContext = await generateDatabaseSchemaContext(supabaseClient);

    // Simple detection for personalized queries and time references
    const hasPersonalPronouns = /\b(i|me|my|mine|myself)\b/i.test(message.toLowerCase());
    const hasExplicitTimeReference = /\b(last week|yesterday|this week|last month|today|recently|lately|this morning|last night|august|january|february|march|april|may|june|july|september|october|november|december)\b/i.test(message.toLowerCase());
    const isFollowUpContext = isFollowUp || /\b(that|those|it|this|these|above|mentioned|said|talked about)\b/i.test(message.toLowerCase());
    
    console.log(`[Query Planner] Basic analysis - Personal: ${hasPersonalPronouns}, Time ref: ${hasExplicitTimeReference}, Follow-up: ${isFollowUpContext}`);

    // Enhanced query detection for better routing
    const isContentSeekingQuery = /\b(what did i|show me|entries about|content|wrote|said|find|tell me about|examples|specific|mentioned|talking about|discussed|focused on)\b/i.test(message.toLowerCase());
    const requiresMandatoryVector = isContentSeekingQuery || hasPersonalPronouns;

    const prompt = `You are SOULo's Enhanced Analyst Agent - an intelligent query planning specialist for journal data analysis with SIMPLIFIED and SAFE SQL generation.

**CRITICAL DATABASE TYPE: This is a PostgreSQL database. Use PostgreSQL-specific syntax and functions.**

${getEnhancedSQLConstraints(userTimezone)}

${databaseSchemaContext}

**CRITICAL DATABASE CONTEXT ADHERENCE:**
- You MUST ONLY use table names, column names, and data types that exist in the database schema above
- DO NOT hallucinate or invent table structures, column names, or data types
- STICK STRICTLY to the provided database schema context
- If uncertain about a database structure, use basic select queries instead of complex ones
- Use PostgreSQL-compatible functions and syntax

**IMPORTANT TIME RELATED QUERY PLANNING:** Note that in the "Journal Entries" table the user timestamps are in the column "created_at" and are of the data type timestamptz (example value in database: 2025-08-02 18:57:54.515+00)

SUB-QUESTION/QUERIES GENERATION GUIDELINE (MANDATORY): 
- Break down user query (MANDATORY: remember that current user message might not be a direct query, so you'll have to look in to the conversation context provided to you and look at last user messages to guess the "ASK" and accordingly frame the sub-questions) into ATLEAST 2 sub-questions or more such that all sub-questions can be consolidated to answer the user's ASK 
- CRITICAL: When analyzing vague queries like "I'm confused between these two options" or "help me decide", look at the FULL conversation context to understand what the two options are (e.g., "jobs vs startup", "career choices", etc.) and generate specific sub-questions about those topics
- If user's query is vague, examine the complete conversation history to derive what the user wants to know and frame sub-questions that address their specific decision or dilemma
- For career/life decisions: Generate sub-questions about patterns, emotions, and insights related to the specific options being considered
- For eg. user asks (What % of entries contain the emotion confidence (and is it the dominant one?) when I deal with family matters that also concern health issues? -> sub question 1: How many entries concern family and health both? sub question 2: What are all the emotions and their avg scores ? sub question 3: Rank the emotions)


1. **UUID and User ID Requirements:**
   - ALWAYS use auth.uid() for user filtering (it will be replaced with the actual UUID)
   - NEVER hardcode user IDs or generate fake UUIDs

2. **Table and Column References:**
   - Use "Journal Entries" (with quotes) for the table name
   - FORBIDDEN COLUMNS (NEVER USE): "transcription text", "foreign key", "audio_url", "user_feedback", "edit_status", "translation_status"
   - Valid columns: user_id, created_at, "refined text", emotions, master_themes, entities, sentiment, themeemotion, themes, duration
   - Avoid using "refined text" in SQL queries unless absolutely necessary (it's just text content)

3. **Simplified JSONB Operations:**
   - For emotions: Use emotions->>'emotion_name' for specific emotion values only when needed
   - Avoid complex JSONB operations unless absolutely necessary for the user's specific request
   - When possible, use master_themes array instead of complex emotion JSONB queries

4. **MANDATORY TIME RANGE INTEGRATION:**
   - When timeRange is provided in the step, SQL queries MUST include the date filters
   - Use proper timestamp with time zone format: '2024-08-01T00:00:00Z'::timestamp with time zone
   - ALWAYS include both start and end date filters when timeRange exists

5. **MANDATORY SQL SAFETY RULES:**
   - Generate ONLY basic SELECT queries focusing on: user_id, created_at, master_themes, sentiment, emotions
   - ALWAYS include user_id = auth.uid() in WHERE clause
   - Use proper PostgreSQL syntax with double quotes for table/column names with spaces
   - NEVER use complex timezone expressions - use only simple INTERVAL arithmetic
   - VALIDATE: All SQL must be executable PostgreSQL without syntax errors
   - When in doubt, use basic filtering and let vector search handle complexity
   - Use standard aggregation functions: COUNT, AVG, MAX, MIN, SUM

**CRITICAL TIMEZONE HANDLING RULES (SIMPLIFIED):**

1. **USER TIMEZONE CONTEXT**: User timezone is "${userTimezone}"
2. **DATABASE STORAGE**: All journal entries are stored in UTC in the database
3. **CRITICAL: NEVER GENERATE COMPLEX TIMEZONE SQL**:
   - DO NOT use complex AT TIME ZONE expressions in SQL
   - DO NOT use expressions like "(NOW() AT TIME ZONE 'timezone' - INTERVAL 'X days')"
   - DO NOT use invalid syntax like "'7 days ago (Asia/Kolkata)'"
   - ONLY use simple INTERVAL subtraction: "NOW() - INTERVAL 'X days'"
   - Let the date processing service handle timezone conversion
4. **SAFE TIME EXPRESSIONS ONLY**:
   - ✅ CORRECT: "NOW() - INTERVAL '7 days'"
   - ✅ CORRECT: "NOW() - INTERVAL '1 week'"
   - ✅ CORRECT: "NOW() - INTERVAL '30 days'"
   - ❌ WRONG: "(NOW() AT TIME ZONE 'Asia/Kolkata' - INTERVAL '7 days')"
   - ❌ WRONG: "'7 days ago (Asia/Kolkata)'"
   - ❌ WRONG: "'last week in Asia/Kolkata timezone'"

**CRITICAL VECTOR SEARCH RULES - MUST FOLLOW:**

1. **MANDATORY VECTOR SEARCH SCENARIOS** (Always include vector search regardless of time constraints):
   - ANY query asking for "content", "what I wrote", "what I said", "entries about", "show me", "find"
   - Questions seeking emotional context, feelings, moods, or mental states
   - Requests for examples, patterns, insights, or thematic analysis  
   - Queries about achievements, progress, breakthroughs, or personal growth
   - Comparative analysis ("similar to", "like when", "reminds me of")
   - Reflective queries ("how was I feeling", "what was going through my mind")
   - Follow-up questions referencing previous context
   - Any query with words: "exactly", "specifically", "precisely", "detailed", "in-depth"

2. **HYBRID SEARCH STRATEGY** (SQL + Vector for optimal results):
   - Time-based content queries: Use SQL for date filtering AND vector for semantic content
   - Statistical queries needing examples: SQL for stats AND vector for relevant samples
   - Thematic queries: SQL theme analysis AND vector semantic search
   - Achievement/progress tracking: SQL for metrics AND vector for meaningful content

3. **ENHANCED VECTOR QUERY GENERATION**:
   - MANDATORY: When generating vector search queries, append relevant terms from the master themes and emotions lists provided in the database schema context
   - For negative emotion queries: append negative emotions like "anxiety anger frustration sadness disappointment fear guilt shame regret loneliness pessimism overwhelm"
   - For theme-specific queries: append related theme names from the master themes list
   - For general queries: append contextually relevant emotions and themes from the database context
   - Example: Original sub-question "What are negative emotions expressed?" → Enhanced vector search: "negative emotions anxiety anger frustration sadness disappointment fear guilt shame overwhelm loneliness pessimism regret personal feelings journal entries"
   - Use the user's EXACT words and emotional context in vector searches
   - For "What did I journal in August" → Vector query: "journal entries personal thoughts feelings experiences august"
   - For achievement queries → Vector query: "achievement success accomplishment progress breakthrough proud confidence joy satisfaction pride"
   - For emotional queries → Vector query: "emotions feelings mood emotional state [specific emotions mentioned] [append relevant emotions from database context]"
   - Preserve user's original language patterns for better semantic matching

4. **SIMPLIFIED DATE FILTERING RULES**:
     - For recent queries (last week, past 30 days): Use simple INTERVAL subtraction
     - NEVER generate complex timezone expressions in SQL
     - Example for "last week": 
       \`\`\`sql
       SELECT COUNT(*) as entry_count
       FROM "Journal Entries" 
       WHERE user_id = auth.uid() AND created_at >= NOW() - INTERVAL '7 days'
       ORDER BY created_at DESC;
       \`\`\`
     - All timeRange objects MUST include "timezone": "${userTimezone}"
     - Keep SQL simple and let edge function handle timezone conversion

USER QUERY: "${message}"
USER TIMEZONE: "${userTimezone}"
CONVERSATION CONTEXT (Last 6 messages): ${last.length > 0 ? last.map((m)=>`${m.role || m.sender}: ${m.content || 'N/A'}`).join('\n  ') : 'None'}

ANALYSIS REQUIREMENTS:
- Content-seeking detected: ${isContentSeekingQuery}
- Mandatory vector required: ${requiresMandatoryVector}  
- Has personal pronouns: ${hasPersonalPronouns}
- Has time reference: ${hasExplicitTimeReference}
- Is follow-up query: ${isFollowUpContext}
- User timezone: ${userTimezone}

Generate a comprehensive analysis plan that:
1. MANDATES vector search for any content-seeking scenario
2. Uses hybrid approach (SQL + vector) for time-based content queries
3. Creates semantically rich vector search queries using user's language
4. INCLUDES proper timezone information in all timeRange objects
5. Generates COMPLETE, SAFE, EXECUTABLE SQL queries using ONLY the provided database schema and working patterns above
6. NEVER references forbidden columns: transcription text, foreign key, audio_url, user_feedback, edit_status, translation_status
7. Uses "refined text" as the primary content source (NEVER transcription text)
8. Ensures comprehensive coverage of user's intent

Response format (MUST be valid JSON):
{
  "queryType": "journal_specific|general_inquiry|mental_health",
  "strategy": "intelligent_sub_query|comprehensive_hybrid|vector_mandatory",
  "userStatusMessage": "Brief status for user",
  "subQuestions": [
    {
      "id": "sq1",
      "question": "Specific sub-question",
      "purpose": "Why this question is needed",
      "searchStrategy": "vector_mandatory|sql_primary|hybrid_parallel",
      "executionStage": 1,
      "dependencies": ["sq1", "sq2"] or [],
      "resultForwarding": "entry_ids_for_next_steps|emotion_data_for_ranking|null",
      "executionMode": "parallel|sequential|conditional",
      "analysisSteps": [
        {
          "step": 1,
          "description": "What this step does",
          "queryType": "vector_search|sql_analysis|hybrid_search",
          "sqlQuery": "COMPLETE EXECUTABLE SQL QUERY using only existing database schema and working patterns" or null,
          "vectorSearch": {
            "query": "Semantically rich search query using user's words",
            "threshold": 0.3,
            "limit": 15
          } or null,
          "timeRange": {"start": "ISO_DATE", "end": "ISO_DATE", "timezone": "${userTimezone}"} or null,
          "resultContext": "use_entry_ids_from_sq1|use_emotion_data_from_sq2|null",
          "dependencies": ["sq1"] or []
        }
      ]
    }
  ],
  "confidence": 0.8,
  "reasoning": "Explanation of strategy with emphasis on dependency management and execution orchestration",
  "useAllEntries": boolean,
  "hasPersonalPronouns": ${hasPersonalPronouns},
  "hasExplicitTimeReference": ${hasExplicitTimeReference},
  "inferredTimeContext": null or timeframe_object_with_timezone,
  "userTimezone": "${userTimezone}"
}`;

    console.log(`[Query Planner] Calling OpenAI API for intelligent plan generation`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini-2025-04-14',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: message }
        ],
        max_completion_tokens: 2000,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      console.error(`[Query Planner] OpenAI API error: ${response.status}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Query Planner] OpenAI API response received`);

    let queryPlan;
    try {
      queryPlan = JSON.parse(data.choices[0].message.content);
      console.log(`[Query Planner] Query plan generated successfully with ${queryPlan.subQuestions?.length || 0} sub-questions`);
    } catch (parseError) {
      console.error(`[Query Planner] JSON parsing error:`, parseError);
      console.error(`[Query Planner] Raw response:`, data.choices[0].message.content);
      throw new Error('Failed to parse query plan from OpenAI response');
    }

    return queryPlan;

  } catch (error) {
    console.error(`[Query Planner] Error in analyzeQueryWithSubQuestions:`, error);
    
    // Simple fallback - basic query plan
    return {
      queryType: "journal_specific",
      strategy: "comprehensive_hybrid",
      userStatusMessage: "Analyzing your journal entries...",
      subQuestions: [{
        id: "sq1",
        question: "Find relevant journal entries",
        purpose: "Retrieve entries that match the user's query",
        searchStrategy: "hybrid_parallel",
        executionStage: 1,
        dependencies: [],
        resultForwarding: null,
        executionMode: "parallel",
        analysisSteps: [{
          step: 1,
          description: "Search for relevant entries",
          queryType: "hybrid_search",
          sqlQueryType: "filtering",
          sqlQuery: 'SELECT * FROM "Journal Entries" WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 25',
          vectorSearch: {
            query: `${message} personal thoughts feelings journal entries`,
            threshold: 0.3,
            limit: 15
          },
          timeRange: null,
          resultContext: null,
          dependencies: []
        }]
      }],
      confidence: 0.6,
      reasoning: "Using fallback plan due to OpenAI processing error",
      useAllEntries: false,
      hasPersonalPronouns: /\b(i|me|my|mine|myself)\b/i.test(message.toLowerCase()),
      hasExplicitTimeReference: /\b(last week|yesterday|this week|last month|today|recently|lately|this morning|last night|august|january|february|march|april|may|june|july|september|october|november|december)\b/i.test(message.toLowerCase()),
      inferredTimeContext: null,
      userTimezone
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { message, userId, execute = true, conversationContext = [], timeRange = null, threadId, messageId, isFollowUp = false, userTimezone = 'UTC' } = await req.json();

    const requestId = `planner_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    console.log(`[REQUEST START] ${requestId}: {
  message: "${message}",
  userId: "${userId}",
  execute: ${execute},
  timestamp: "${new Date().toISOString()}",
  contextLength: ${conversationContext?.length || 0},
  timeRange: ${JSON.stringify(timeRange)},
  threadId: "${threadId}",
  messageId: ${messageId},
  isFollowUp: ${isFollowUp},
  userTimezone: "${userTimezone}"
}`);

    // Validate userId format
    if (!isValidUUID(userId)) {
      throw new Error(`Invalid user ID format: ${userId}`);
    }

    // Get user's journal entry count for context
    const { count: countData } = await supabaseClient
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    const userEntryCount = countData || 0;
    console.log(`[${requestId}] User has ${userEntryCount} journal entries`);

    // Generate comprehensive analysis plan with enhanced SQL generation
    const analysisResult = await analyzeQueryWithSubQuestions(message, conversationContext, userEntryCount, isFollowUp, supabaseClient, userTimezone);

    if (!execute) {
      // Return just the plan without execution
      return new Response(JSON.stringify({
        queryPlan: analysisResult,
        timestamp: new Date().toISOString(),
        requestId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Execute the plan and return results
    const executionResult = await executePlan(analysisResult, userId, supabaseClient, requestId, userTimezone);
    
    return new Response(JSON.stringify({
      queryPlan: analysisResult,
      executionResult,
      timestamp: new Date().toISOString(),
      requestId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in smart query planner:', error);
    return new Response(JSON.stringify({
      error: error.message,
      fallbackPlan: {
        queryType: "error_fallback",
        strategy: "vector_mandatory",
        subQuestions: [{
          question: "Enhanced vector search fallback",
          searchStrategy: "vector_mandatory",
          analysisSteps: [{
            step: 1,
            queryType: "vector_search",
            vectorSearch: {
              query: "personal journal experiences thoughts feelings",
              threshold: 0.3,
              limit: 10
            },
            timeRange: null
          }]
        }],
        useAllEntries: true,
        userTimezone: 'UTC'
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});