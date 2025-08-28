import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { 
  generateDatabaseSchemaContext, 
  getEmotionAnalysisGuidelines, 
  getThemeAnalysisGuidelines 
} from '../_shared/databaseSchemaContext.ts';
import { executeSQLAnalysis, executeBasicSQLQuery } from './sqlExecution.ts';

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
      if (result.subQuestion?.id === 'final_content_retrieval') {
        // This is the mandatory final vector search - mark it specially
        const vectorSummary = await processVectorResults(result.executionResults.vectorResults, totalEntries, requestId);
        processedResult.executionSummary = {
          ...vectorSummary,
          resultType: 'journal_content_retrieval',
          dataType: 'journal_entries',
          isMandatoryFinalStep: true
        };
      } else {
        processedResult.executionSummary = await processVectorResults(result.executionResults.vectorResults, totalEntries, requestId);
      }
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
 * Enhanced SQL query validation to catch common PostgreSQL errors before execution
 */
function validateSQLQuery(sqlQuery: string): { isValid: boolean; errors: string[]; suggestions: string[] } {
  const errors: string[] = [];
  const suggestions: string[] = [];
  
  // Check for common JSONB mistakes
  if (sqlQuery.includes('json_object_keys(emotions)') && sqlQuery.includes('jsonb')) {
    errors.push('Mixing json_object_keys() with JSONB data type');
    suggestions.push('Use jsonb_object_keys(emotions) for JSONB columns or jsonb_each(emotions) for key-value iteration');
  }
  
  // Check for incorrect emotion querying patterns
  if (sqlQuery.includes('emotions->') && !sqlQuery.includes('::numeric')) {
    suggestions.push('Remember to cast JSONB values to numeric: (emotions->>\'emotion_name\')::numeric');
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
  
  // Fix JSONB iteration patterns - replace problematic nested aggregation
  if (rewritten.includes('jsonb_object_keys(emotions)') && rewritten.includes('AVG((emotions->>jsonb_object_keys(emotions))::numeric)')) {
    // Replace with proper JSONB iteration using jsonb_each
    rewritten = rewritten.replace(
      /SELECT jsonb_object_keys\(emotions\) AS emotion, ROUND\(AVG\(\(emotions->>jsonb_object_keys\(emotions\)\)::numeric\), 3\) AS avg_score FROM "Journal Entries" WHERE user_id = auth\.uid\(\)(.*?)GROUP BY emotion/gs,
      `WITH emotion_scores AS (
        SELECT e.key as emotion_name, (e.value::text)::numeric as emotion_score
        FROM "Journal Entries" entries, jsonb_each(entries.emotions) e
        WHERE entries.user_id = auth.uid()$1
      )
      SELECT emotion_name as emotion, ROUND(AVG(emotion_score), 3) as avg_score 
      FROM emotion_scores 
      GROUP BY emotion_name`
    );
  }
  
  // Add proper table and column quoting
  rewritten = rewritten.replace(/Journal Entries(?!")/g, '"Journal Entries"');
  rewritten = rewritten.replace(/refined text(?!")/g, '"refined text"');
  
  return rewritten;
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
            // Build SQL context for mandatory final vector search
            let sqlContext = null;
            if (step.resultContext === "use_sql_context_for_semantic_search") {
              sqlContext = {
                emotions: [],
                themes: [],
                sentiments: []
              };
              
              // Collect SQL context from dependencies
              Object.values(subResults.executionResults.dependencyContext).forEach((depContext: any) => {
                if (depContext.sqlResults) {
                  depContext.sqlResults.forEach((row: any) => {
                    if (row.emotion && row.avg_score !== undefined) {
                      sqlContext.emotions.push({ emotion: row.emotion, score: row.avg_score });
                    }
                    if (row.theme && row.count !== undefined) {
                      sqlContext.themes.push({ theme: row.theme, count: row.count });
                    }
                    if (row.avg_sentiment !== undefined) {
                      sqlContext.sentiments.push({ sentiment: row.avg_sentiment });
                    }
                  });
                }
              });
              
              console.log(`[${requestId}] Built SQL context for vector search:`, sqlContext);
            }
            
            const vectorResult = await executeVectorSearch(step.vectorSearch, userId, supabaseClient, requestId, step.timeRange, userTimezone, sqlContext);
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
  userTimezone: string = 'UTC',
  sqlContext: any = null
) {
  console.log(`[${requestId}] Executing vector search: "${vectorSearch.query}"`);
  
  try {
    // Enhanced query building using SQL context for mandatory final search
    let enhancedQuery = vectorSearch.query;
    
    if (sqlContext && vectorSearch.query.includes('[Combine user\'s original')) {
      // This is the mandatory final search - enhance query with SQL context
      const contextTerms = [];
      
      // Extract top emotions from SQL context
      if (sqlContext.emotions && Array.isArray(sqlContext.emotions)) {
        const topEmotions = sqlContext.emotions.slice(0, 3).map(e => e.emotion || e.key);
        contextTerms.push(...topEmotions);
      }
      
      // Extract top themes from SQL context
      if (sqlContext.themes && Array.isArray(sqlContext.themes)) {
        const topThemes = sqlContext.themes.slice(0, 3).map(t => t.theme);
        contextTerms.push(...topThemes);
      }
      
      // Build enhanced semantic query
      enhancedQuery = `${vectorSearch.query.replace(/\[.*?\]/g, '')} ${contextTerms.join(' ')}`.trim();
      console.log(`[${requestId}] Enhanced vector query with SQL context: "${enhancedQuery}"`);
    }
    
    // Generate embedding for the search query
    const embedding = await generateEmbedding(enhancedQuery);
    
    let vectorResults;
    
    // Try with time range if available
    if (timeRange && (timeRange.start || timeRange.end)) {
      console.log(`[${requestId}] Vector search with time range: ${timeRange.start} to ${timeRange.end}`);
      const { data, error } = await supabaseClient.rpc('match_journal_entries_with_date', {
        query_embedding: embedding,
        match_threshold: vectorSearch.threshold || 0.2,
        match_count: vectorSearch.limit || 12,
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
    
    console.log(`[Query Planner] Processing query with enhanced validation and user timezone: ${userTimezone}`);
    
    // Get live database schema with real themes and emotions using the authenticated client
    const databaseSchemaContext = await generateDatabaseSchemaContext(supabaseClient);

    // Enhanced detection for personalized queries and comprehensive time references
    const hasPersonalPronouns = /\b(i|me|my|mine|myself)\b/i.test(message.toLowerCase());
    const hasExplicitTimeReference = /\b(last\s+(?:\d+[-\s]?\d*\s+)?(?:days?|weeks?|months?|years?)|yesterday|today|this\s+(?:week|month|year|morning|evening)|past\s+(?:few\s+)?(?:days?|weeks?|months?)|recently|lately|earlier|before|after|since|until|during|when|(?:last|this)\s+(?:week|month|year|night|morning|evening|afternoon)|(?:august|january|february|march|april|may|june|july|september|october|november|december)|(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|(?:\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i.test(message.toLowerCase());
    const isFollowUpContext = isFollowUp || /\b(that|those|it|this|these|above|mentioned|said|talked about)\b/i.test(message.toLowerCase());
    
    console.log(`[Query Planner] Enhanced analysis - Personal: ${hasPersonalPronouns}, Time ref: ${hasExplicitTimeReference}, Follow-up: ${isFollowUpContext}`);

    const prompt = `You are Ruh's Enhanced Intelligent Query Planner - a precise execution engine for a voice journaling app called SOuLO. Your job is to analyze user queries and return structured JSON plans with BULLETPROOF PostgreSQL queries.

CRITICAL DATABASE SCHEMA (PostgreSQL):
${databaseSchemaContext}

## CONVERSATION CONTEXT ANALYSIS:
The conversation context will help you understand temporal references naturally.

===== COMPLETE JOURNAL ENTRIES TABLE COLUMN SPECIFICATION =====

Table: "Journal Entries" (ALWAYS use quotes)
MANDATORY COLUMNS & DATA TYPES (PostgreSQL):

1. **id** (bigint, Primary Key): Entry identifier
   ✅ VALID: entries.id = 123
   ❌ INVALID: entries.id::text = '123'

2. **user_id** (uuid, NOT NULL): User identifier  
   ✅ VALID: entries.user_id = auth.uid()
   ✅ VALID: entries.user_id = '1e7caad7-180d-439c-abd4-2f0d45256f68'
   ❌ INVALID: entries.user_id::text = 'uuid-string'

3. **"refined text"** (text, Nullable): Main content - ALWAYS use quotes
   ✅ VALID: entries."refined text"
   ✅ VALID: COALESCE(entries."refined text", entries."transcription text") as content
   ❌ INVALID: entries.refined_text, entries.refinedtext

4. **"transcription text"** (text, Default ''): Original speech - ALWAYS use quotes
   ✅ VALID: entries."transcription text"
   ❌ INVALID: entries.transcription_text, entries.transcriptiontext

5. **sentiment** (real, Nullable): Sentiment score (-1 to 1)
   ✅ VALID: ROUND(AVG(entries.sentiment::numeric), 3) as avg_sentiment
   ✅ VALID: entries.sentiment::numeric > 0.5
   ❌ BROKEN: ROUND(AVG(entries.sentiment), 3) -- WILL FAIL: real type incompatible
   ❌ BROKEN: SELECT sentiment FROM... -- Direct real math operations fail

6. **emotions** (jsonb, Nullable): Emotion scores as {"emotion": 0.85}
   ✅ VALID: SELECT e.key as emotion, ROUND(AVG((e.value::text)::numeric), 3) as avg_score FROM "Journal Entries" entries, jsonb_each(entries.emotions) e WHERE entries.user_id = auth.uid() GROUP BY e.key
   ✅ VALID: entries.emotions ? 'happiness' AND (entries.emotions->>'happiness')::numeric > 0.5
   ❌ BROKEN: jsonb_object_keys(emotions) -- Function doesn't exist
   ❌ BROKEN: json_object_keys(emotions) -- Wrong function for jsonb

7. **master_themes** (text[], Nullable): Theme categories
   ✅ VALID: SELECT theme, COUNT(*) FROM "Journal Entries" entries, unnest(entries.master_themes) as theme WHERE entries.user_id = auth.uid() GROUP BY theme
   ✅ VALID: entries.master_themes @> ARRAY['work']
   ✅ VALID: 'work' = ANY(entries.master_themes)
   ❌ INVALID: entries.master_themes[0] -- Direct array indexing risky

8. **entities** (jsonb, Nullable): Named entities as {"person": ["John", "Mary"]}
   ✅ VALID: SELECT entity_name, COUNT(*) FROM "Journal Entries" entries, jsonb_each(entries.entities) as ent(ent_key, ent_value), jsonb_array_elements_text(ent_value) as entity_name WHERE entries.user_id = auth.uid() GROUP BY entity_name
   ❌ INVALID: Mixing jsonb functions incorrectly

9. **created_at** (timestamp with time zone, NOT NULL): Entry creation time
   ✅ VALID: entries.created_at >= (NOW() AT TIME ZONE '${userTimezone}' - INTERVAL '7 days')
   ✅ VALID: entries.created_at >= '2025-08-21T00:00:00+05:30'::timestamptz
   ✅ VALID: DATE_TRUNC('day', entries.created_at AT TIME ZONE '${userTimezone}')
   ❌ INVALID: created_at > 'today' -- Use proper timestamp

10. **duration** (numeric, Nullable): Entry length in seconds
    ✅ VALID: entries.duration > 60.0
    ✅ VALID: AVG(entries.duration)

11. **themeemotion** (jsonb, Nullable): Theme-emotion relationships
    ✅ VALID: jsonb_each(entries.themeemotion)
    
12. **entityemotion** (jsonb, Nullable): Entity-emotion relationships  
    ✅ VALID: jsonb_each(entries.entityemotion)

===== CRITICAL DATA TYPE CASTING RULES =====

**REAL TO NUMERIC CASTING (MANDATORY for sentiment):**
✅ CORRECT: entries.sentiment::numeric
✅ CORRECT: ROUND(AVG(entries.sentiment::numeric), 3)
✅ CORRECT: CAST(entries.sentiment AS numeric)
❌ BROKEN: ROUND(AVG(entries.sentiment), 3) -- WILL FAIL
❌ BROKEN: entries.sentiment + 1 -- WILL FAIL

**JSONB VALUE EXTRACTION:**
✅ CORRECT: (entries.emotions->>'happiness')::numeric
✅ CORRECT: (e.value::text)::numeric from jsonb_each
❌ BROKEN: entries.emotions->'happiness'::numeric -- Wrong cast order

**TEXT ARRAY OPERATIONS:**
✅ CORRECT: unnest(entries.master_themes) as theme
✅ CORRECT: array_length(entries.master_themes, 1)
❌ BROKEN: entries.master_themes[*] -- Postgres doesn't support

===== MANDATORY SQL PATTERNS =====

EMOTION ANALYSIS (COPY EXACTLY):
SELECT e.key as emotion, ROUND(AVG((e.value::text)::numeric), 3) as avg_score 
FROM "Journal Entries" entries, jsonb_each(entries.emotions) e 
WHERE entries.user_id = auth.uid() 
GROUP BY e.key 
ORDER BY avg_score DESC LIMIT 5

SENTIMENT ANALYSIS (COPY EXACTLY):
SELECT ROUND(AVG(entries.sentiment::numeric), 3) as avg_sentiment 
FROM "Journal Entries" entries 
WHERE entries.user_id = auth.uid()

THEME ANALYSIS (COPY EXACTLY):
SELECT theme, COUNT(*) as count 
FROM "Journal Entries" entries, unnest(entries.master_themes) as theme 
WHERE entries.user_id = auth.uid() 
GROUP BY theme 
ORDER BY count DESC LIMIT 5

TIME-FILTERED CONTENT (COPY EXACTLY):
SELECT entries.id, entries."refined text", entries.created_at
FROM "Journal Entries" entries
WHERE entries.user_id = auth.uid() 
AND entries.created_at >= (NOW() AT TIME ZONE '${userTimezone}' - INTERVAL '7 days')
ORDER BY entries.created_at DESC

===== CRITICAL: VECTOR SEARCH FUNCTION SPECIFICATION =====

ONLY FUNCTION FOR TIME-CONSTRAINED VECTOR SEARCH:
Function: match_journal_entries_with_date
Parameters: (query_embedding, match_threshold, match_count, user_id_filter, start_date, end_date)

WHEN TO USE VECTOR SEARCH WITH TIME:
- User mentions specific time periods (this week, last month, recently, etc.)
- Emotional/semantic queries with time context
- Theme analysis over time periods
- Any question combining content search + time filter

VECTOR SEARCH PARAMETERS:
- threshold: 0.15-0.25 for time-constrained (lower to compensate for filtering)
- limit: 15-25 for time-constrained (higher to compensate for filtering)  
- query: Use user's semantic terms + context (emotions, themes, time words)

EXAMPLE VECTOR SEARCH STEP WITH DYNAMIC TIME CALCULATION:
{
  "step": 1,
  "description": "Vector search for emotional content from this week",
  "queryType": "vector_search",
  "vectorSearch": {
    "query": "emotions feelings mood this week recent",
    "threshold": 0.2,
    "limit": 20
  },
  "timeRange": {
    "start": "[CALCULATE Monday of current week in user timezone]T00:00:00+[user timezone offset]",
    "end": "[CALCULATE Sunday of current week in user timezone]T23:59:59+[user timezone offset]", 
    "timezone": "${userTimezone}"
  }
}

EXAMPLE SQL WITH DYNAMIC TIME CALCULATION:
{
  "step": 1,
  "description": "Analyze emotions from last 7 days",
  "queryType": "sql_analysis",
  "sqlQueryType": "analysis",
  "sqlQuery": "SELECT e.key as emotion, ROUND(AVG((e.value::text)::numeric), 3) as avg_score FROM \"Journal Entries\" entries, jsonb_each(entries.emotions) e WHERE entries.user_id = auth.uid() AND entries.created_at >= '[CALCULATE 7 days ago]T00:00:00+[timezone offset]'::timestamptz GROUP BY e.key ORDER BY avg_score DESC LIMIT 5",
  "timeRange": {
    "start": "[CALCULATE 7 days ago]T00:00:00+[timezone offset]",
    "end": "[CALCULATE current time]T23:59:59+[timezone offset]",
    "timezone": "${userTimezone}"
  }
}

===== HOLISTIC QUERY SCENARIOS =====

**SCENARIO 1: Time + Emotions + Vector Priority**
User: "How have I been feeling this week?"
✅ PREFERRED: Vector search with time range (threshold: 0.2, limit: 20)
✅ BACKUP: SQL emotion analysis with time filter
❌ AVOID: SQL-only without semantic understanding

**SCENARIO 2: Theme Analysis + Time**  
User: "What work issues came up last month?"
✅ PREFERRED: Vector search "work issues problems stress" with time range
✅ BACKUP: SQL theme filter + vector search for context
❌ AVOID: Theme array query without semantic search

**SCENARIO 3: Sentiment Tracking**
User: "Has my mood been improving?"  
✅ PREFERRED: Vector search + SQL sentiment trend analysis
✅ REQUIRED: CAST sentiment to numeric for all math operations
❌ BROKEN: Direct ROUND(AVG(sentiment)) without casting

**SCENARIO 4: Entity + Emotion Relationships**
User: "How do I feel about John lately?"
✅ PREFERRED: Vector search "John emotions feelings" with time range
✅ BACKUP: Entity-emotion JSON analysis with person filter
❌ AVOID: Simple entity search without emotional context

===== PROGRESSIVE FALLBACK STRATEGY =====

1. **Primary**: Vector search with exact time range (threshold: 0.2)
2. **Secondary**: Vector search with expanded time range (threshold: 0.18)
3. **Tertiary**: Vector search with broader time (threshold: 0.15)
4. **Final**: Vector search without time constraints (threshold: 0.25)
5. **Last Resort**: SQL analysis with proper data type casting

USER QUERY: "${message}"
USER TIMEZONE: "${userTimezone}"
CURRENT DATE: ${new Date().toISOString().split('T')[0]} (YYYY-MM-DD format)
CURRENT YEAR: ${new Date().getFullYear()}
CURRENT TIME: ${new Date().toLocaleString('en-US', { timeZone: userTimezone })} (in user timezone)
CONVERSATION CONTEXT: ${last.length > 0 ? last.map((m)=>`${m.role || m.sender}: ${m.content || 'N/A'}`).join('\n  ') : 'None'}

===== CRITICAL: TIME RANGE CALCULATION INSTRUCTIONS =====

**MANDATORY TIME CALCULATIONS FOR COMMON PHRASES:**

When user mentions time phrases, you MUST calculate exact ISO timestamps:

1. **"today"** = Start: ${new Date().toLocaleDateString('sv-SE', { timeZone: userTimezone })}T00:00:00+XX:XX, End: ${new Date().toLocaleDateString('sv-SE', { timeZone: userTimezone })}T23:59:59+XX:XX

2. **"yesterday"** = Calculate previous day in user timezone

3. **"this week"** = Calculate Monday to Sunday of current week in user timezone

4. **"last week"** = Calculate Monday to Sunday of previous week in user timezone  

5. **"this month"** = Calculate first day to last day of current month in user timezone

6. **"last month"** = Calculate first day to last day of previous month in user timezone

7. **"last 2-3 days"** = Calculate 3 days ago to now in user timezone

8. **"past few days"** = Calculate 3-4 days ago to now in user timezone

9. **"recently/lately"** = Calculate 7 days ago to now in user timezone

10. **"last N days/weeks/months"** = Calculate N periods ago to now in user timezone

**TIMEZONE OFFSET CALCULATION:**
- For timezone "${userTimezone}": Use appropriate offset (e.g., +05:30 for Asia/Kolkata, -08:00 for US/Pacific)
- ALWAYS include timezone offset in ISO timestamps
- Convert "NOW()" references to actual calculated timestamps

**EXAMPLE TIME RANGE CALCULATIONS:**

For "last 7 days" in Asia/Kolkata timezone:
{
  "timeRange": {
    "start": "${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}T00:00:00+05:30",
    "end": "${new Date().toISOString().split('T')[0]}T23:59:59+05:30",
    "timezone": "${userTimezone}"
  }
}

For "this week" in user timezone:
{
  "timeRange": {
    "start": "[Calculate Monday of current week]T00:00:00+[offset]",
    "end": "[Calculate Sunday of current week]T23:59:59+[offset]", 
    "timezone": "${userTimezone}"
  }
}

**CRITICAL: EVERY TIME REFERENCE MUST HAVE CALCULATED timeRange**
- NO null timeRange values when user mentions time
- NO "recent" without specific date calculations  
- NO relative terms without absolute timestamps
- ALWAYS provide both start and end ISO timestamps with timezone offset

**CRITICAL CONTEXT ANALYSIS:**
Examine the conversation context to understand the actual user intent:
1. Look at previous ASSISTANT responses for topics discussed (emotions, themes, time periods)
2. Connect current USER message to those topics
3. When user asks "how has it been moving" or similar, link to the SPECIFIC topic from previous analysis
4. Generate sub-questions that CONTINUE the analysis thread, not start new unrelated analysis
5. Preserve entity names, emotion names, time periods from previous responses

ANALYSIS STATUS:
- Follow-up query: ${isFollowUpContext}
- User timezone: ${userTimezone}

===== MANDATORY FINAL VECTOR SEARCH REQUIREMENT =====

**CRITICAL: ALL QUERY PLANS MUST END WITH A JOURNAL CONTENT RETRIEVAL STEP**

Every query plan MUST include a final vector search step that:
1. Retrieves actual journal entry content to support SQL analysis results
2. Uses semantic terms from the user's original query + analysis context
3. Applies time range and filters established by previous SQL steps
4. Provides specific journal excerpts for the consolidator to quote and reference
5. Ensures responses are both quantified (SQL data) AND evidence-backed (journal content)

**MANDATORY FINAL STEP TEMPLATE (COPY EXACTLY):**
{
  "id": "final_content_retrieval",
  "question": "Retrieve actual journal entries that match the analysis",
  "purpose": "Provide specific journal content to support and illustrate the statistical findings from previous SQL analysis",
  "searchStrategy": "vector_mandatory",
  "executionStage": 2,
  "dependencies": ["sq1", "sq2", "sq3"],
  "resultForwarding": "journal_entries_for_consolidator",
  "executionMode": "sequential",
  "analysisSteps": [{
    "step": 1,
    "description": "Vector search for journal entries matching user's semantic query with context from SQL results",
    "queryType": "vector_search",
    "vectorSearch": {
      "query": "[Combine user's original emotional/thematic terms + top results from SQL analysis]",
      "threshold": 0.2,
      "limit": 12
    },
    "timeRange": "[Inherit from previous SQL analysis timeRange if any]",
    "resultContext": "use_sql_context_for_semantic_search",
    "dependencies": ["sq1", "sq2"]
  }]
}

**EXECUTION STRATEGY:**
- Stage 1: All SQL sub-questions (emotions, themes, sentiment analysis) - PARALLEL execution
- Stage 2: Final vector search using SQL context - SEQUENTIAL execution after Stage 1
- Result: Consolidator receives BOTH quantified analysis AND actual journal content

**RESPONSE FORMAT (MUST be valid JSON):**
{
  "queryType": "journal_specific|general_inquiry|mental_health",
  "strategy": "intelligent_sub_query|comprehensive_hybrid|vector_mandatory",
  "userStatusMessage": "Brief status for user",
  "subQuestions": [
    {
      "id": "sq1",
      "question": "Specific sub-question",
      "purpose": "Why this question is needed",
      "searchStrategy": "sql_primary|hybrid_parallel",
      "executionStage": 1,
      "dependencies": [],
      "resultForwarding": "emotion_data_for_ranking|theme_data_for_context|null",
      "executionMode": "parallel",
      "analysisSteps": [
        {
          "step": 1,
          "description": "What this step does",
          "queryType": "sql_analysis",
          "sqlQueryType": "analysis",
          "sqlQuery": "COMPLETE PostgreSQL query using EXACT patterns above",
          "vectorSearch": null,
          "timeRange": {"start": "[CALCULATED ISO TIMESTAMP WITH TIMEZONE]", "end": "[CALCULATED ISO TIMESTAMP WITH TIMEZONE]", "timezone": "${userTimezone}"} or null,
          "resultContext": null,
          "dependencies": []
        }
      ]
    },
    {
      "id": "final_content_retrieval",
      "question": "Retrieve actual journal entries that match the analysis",
      "purpose": "Provide specific journal content to support and illustrate the statistical findings",
      "searchStrategy": "vector_mandatory",
      "executionStage": 2,
      "dependencies": ["sq1"],
      "resultForwarding": "journal_entries_for_consolidator",
      "executionMode": "sequential",
      "analysisSteps": [{
        "step": 1,
        "description": "Vector search for journal entries matching user's semantic query",
        "queryType": "vector_search",
        "vectorSearch": {
          "query": "User's original terms + context from SQL results",
          "threshold": 0.2,
          "limit": 12
        },
        "timeRange": null,
        "resultContext": "use_sql_context_for_semantic_search",
        "dependencies": ["sq1"]
      }]
    }
    }
  ],
  "confidence": 0.8,
  "reasoning": "Strategy explanation with context awareness",
  "useAllEntries": boolean,
  "userTimezone": "${userTimezone}",
  "sqlValidationEnabled": true
}

**MANDATORY QUALITY CHECKS:**
✓ All SQL queries use exact patterns from examples above
✓ timeRange preserved across ALL analysisSteps when applicable
✓ JSONB queries use jsonb_each() not json_object_keys()
✓ Proper column/table quoting with spaces
✓ Timezone-aware date operations
✓ EVERY time reference in user query MUST have calculated timeRange with actual ISO timestamps
✓ NO null timeRange when user mentions any temporal phrases
✓ ALL timestamps MUST include proper timezone offset for "${userTimezone}"

**FINAL VALIDATION - TIME RANGE REQUIREMENTS:**
- If user mentions "today", "yesterday", "this week", "last week", "recently", "lately", "past few days", "last N days/weeks/months" → timeRange is MANDATORY
- Calculate actual start/end timestamps, don't use placeholders
- Use proper timezone offset for "${userTimezone}"
- Both SQL and vector search steps MUST include the same timeRange when time is mentioned`;

    console.log(`[Query Planner] Calling OpenAI API with enhanced PostgreSQL patterns`);

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
        max_completion_tokens: 2500,
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
      
      // Enhanced validation and rewriting of SQL queries
      if (queryPlan.subQuestions) {
        for (const subQ of queryPlan.subQuestions) {
          if (subQ.analysisSteps) {
            for (const step of subQ.analysisSteps) {
              if (step.sqlQuery) {
                const validation = validateSQLQuery(step.sqlQuery);
                if (!validation.isValid) {
                  console.warn(`[Query Planner] SQL validation failed for ${subQ.id}: ${validation.errors.join(', ')}`);
                  console.log(`[Query Planner] Suggestions: ${validation.suggestions.join(', ')}`);
                  
                  // Attempt to rewrite the query
                  const rewritten = rewriteProblematicSQL(step.sqlQuery);
                  if (rewritten !== step.sqlQuery) {
                    console.log(`[Query Planner] Rewrote SQL query for ${subQ.id}`);
                    step.sqlQuery = rewritten;
                    step.originalQuery = step.sqlQuery; // Keep track of original
                    step.wasRewritten = true;
                  }
                }
              }
            }
          }
        }
      }
      
      console.log(`[Query Planner] Enhanced query plan generated with ${queryPlan.subQuestions?.length || 0} sub-questions`);
    } catch (parseError) {
      console.error(`[Query Planner] JSON parsing error:`, parseError);
      console.error(`[Query Planner] Raw response:`, data.choices[0].message.content);
      throw new Error('Failed to parse enhanced query plan from OpenAI response');
    }

    return queryPlan;

  } catch (error) {
    console.error(`[Query Planner] Error in enhanced query analysis:`, error);
    
    // Enhanced fallback with better SQL patterns
    return {
      queryType: "journal_specific",
      strategy: "comprehensive_hybrid", 
      userStatusMessage: "Analyzing your journal entries with enhanced patterns...",
      subQuestions: [{
        id: "sq1",
        question: "Find relevant journal entries using enhanced search",
        purpose: "Retrieve entries with improved PostgreSQL patterns",
        searchStrategy: "hybrid_parallel",
        executionStage: 1,
        dependencies: [],
        resultForwarding: null,
        executionMode: "parallel",
        analysisSteps: [{
          step: 1,
          description: "Enhanced search with proper SQL patterns",
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
      reasoning: "Using enhanced fallback plan with improved PostgreSQL patterns",
      useAllEntries: false,
      userTimezone,
      sqlValidationEnabled: true
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

    const { message, userId, execute = true, conversationContext = [], threadId, messageId, isFollowUp = false, userTimezone = 'UTC' } = await req.json();

    const requestId = `planner_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    console.log(`[REQUEST START] ${requestId}: {
  message: "${message}",
  userId: "${userId}",
  execute: ${execute},
  timestamp: "${new Date().toISOString()}",
  contextLength: ${conversationContext?.length || 0},
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
