import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { 
  generateDatabaseSchemaContext, 
  getEmotionAnalysisGuidelines, 
  getThemeAnalysisGuidelines 
} from '../_shared/databaseSchemaContext.ts';
import { extractAndParseJSON } from './extractAndParseJSON.ts';

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

function sanitizeUserIdInQuery(query: string, userId: string, requestId: string): string {
  if (!isValidUUID(userId)) {
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


// Tests the functionality of vector operations with comprehensive validation
async function testVectorOperations(supabaseClient: any, requestId: string): Promise<boolean> {
  try {
    console.log(`[${requestId}] Testing vector operations...`);
    
    // Test with enhanced vector verification
    const { data, error } = await supabaseClient.rpc('verify_vector_operations');
    
    if (error) {
      console.error(`[${requestId}] Vector verification RPC error:`, error);
      return false;
    }
    
    if (data && data.success && data.operator_exists) {
      console.log(`[${requestId}] Vector operations verified successfully:`, {
        status: data.vector_extension_status,
        hasEmbeddings: data.has_embeddings,
        operatorExists: data.operator_exists,
        embeddingCount: data.embedding_count
      });
      return true;
    } else {
      console.warn(`[${requestId}] Vector operations verification failed:`, data);
      return false;
    }
  } catch (error) {
    console.error(`[${requestId}] Vector operations test exception:`, error);
    return false;
  }
}

async function executePlan(plan: any, userId: string, supabaseClient: any, requestId: string) {
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

  // Group sub-questions by execution stage
  const stageGroups = groupByExecutionStage(plan.subQuestions);
  console.log(`[${requestId}] Execution stages:`, Object.keys(stageGroups).map(k => `Stage ${k}: ${stageGroups[k].length} sub-questions`));

  const allResults = [];

  // Execute stages sequentially
  for (const stage of Object.keys(stageGroups).sort((a, b) => parseInt(a) - parseInt(b))) {
    console.log(`[${requestId}] Executing stage ${stage} with ${stageGroups[stage].length} sub-questions`);
    executionContext.currentStage = parseInt(stage);

    // Execute sub-questions in parallel within the stage (if they're independent)
    const stageResults = await executeStageInParallel(stageGroups[stage], userId, supabaseClient, requestId, executionContext);
    
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
  return allResults;
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
  executionContext: ExecutionContext
) {
  // Check for dependencies within the stage
  const independentQuestions = subQuestions.filter(sq => !sq.dependencies || sq.dependencies.length === 0);
  const dependentQuestions = subQuestions.filter(sq => sq.dependencies && sq.dependencies.length > 0);

  console.log(`[${requestId}] Stage execution - Independent: ${independentQuestions.length}, Dependent: ${dependentQuestions.length}`);

  const results = [];

  // Execute independent questions in parallel
  if (independentQuestions.length > 0) {
    const independentResults = await Promise.all(
      independentQuestions.map(subQ => executeSubQuestion(subQ, userId, supabaseClient, requestId, executionContext))
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
    const dependentResult = await executeSubQuestion(subQ, userId, supabaseClient, requestId, executionContext);
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
  executionContext: ExecutionContext
) {
  console.log(`[${requestId}] Executing sub-question: ${subQuestion.id} - ${subQuestion.question}`);

  const subResults = {
    subQuestion: subQuestion,
    researcherOutput: null,
    executionResults: {
      sqlResults: [],
      vectorResults: [],
      error: null,
      dependencyContext: {},
      sqlExecutionDetails: {
        originalQuery: null,
        sanitizedQuery: null,
        validationResult: null,
        executionError: null,
        fallbackUsed: false
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
      subResults.executionResults.dependencyContext = processDependencies(subQuestion.dependencies, executionContext);
      console.log(`[${requestId}] Dependency context for ${subQuestion.id}:`, Object.keys(subResults.executionResults.dependencyContext));
    }

    for (const step of subQuestion.analysisSteps) {
      console.log(`[${requestId}] Executing analysis step: ${step.step} - ${step.description}`);

      // Apply dependency context to step if needed
      const enhancedStep = applyDependencyContext(step, subResults.executionResults.dependencyContext, requestId);

      if (enhancedStep.queryType === 'vector_search') {
        console.log(`[${requestId}] Vector search:`, enhancedStep.vectorSearch?.query);
        const vectorResult = await executeVectorSearch(enhancedStep, userId, supabaseClient, requestId, subResults.executionResults.vectorExecutionDetails);
        subResults.executionResults.vectorResults = vectorResult || [];
      } else if (enhancedStep.queryType === 'sql_analysis') {
        console.log(`[${requestId}] SQL analysis:`, enhancedStep.sqlQuery?.substring(0, 100) + '...');
        const sqlResult = await executeSQLAnalysis(enhancedStep, userId, supabaseClient, requestId, subResults.executionResults.sqlExecutionDetails);
        subResults.executionResults.sqlResults = sqlResult || [];
      } else if (enhancedStep.queryType === 'hybrid_search') {
        console.log(`[${requestId}] Hybrid search:`, enhancedStep.vectorSearch?.query);
        const hybridResult = await executeHybridSearch(enhancedStep, userId, supabaseClient, requestId, subResults.executionResults.sqlExecutionDetails, subResults.executionResults.vectorExecutionDetails);
        subResults.executionResults.vectorResults = hybridResult?.vectorResults || [];
        subResults.executionResults.sqlResults = hybridResult?.sqlResults || [];
      }
    }
  } catch (stepError) {
    console.error(`[${requestId}] Error executing sub-question ${subQuestion.id}:`, stepError);
    subResults.executionResults.error = stepError.message;
  }

  return subResults;
}

function processDependencies(dependencies: string[], executionContext: ExecutionContext): any {
  const dependencyContext: any = {};
  
  dependencies.forEach(depId => {
    const depResult = executionContext.subQuestionResults.get(depId);
    if (depResult) {
      dependencyContext[depId] = {
        sqlResults: depResult.executionResults?.sqlResults || [],
        vectorResults: depResult.executionResults?.vectorResults || [],
        entryIds: extractEntryIds(depResult.executionResults)
      };
    }
  });

  return dependencyContext;
}

function extractEntryIds(executionResults: any): string[] {
  const entryIds = [];
  
  // Extract from SQL results
  if (executionResults.sqlResults && Array.isArray(executionResults.sqlResults)) {
    executionResults.sqlResults.forEach((result: any) => {
      if (result.id) entryIds.push(result.id);
    });
  }

  // Extract from vector results  
  if (executionResults.vectorResults && Array.isArray(executionResults.vectorResults)) {
    executionResults.vectorResults.forEach((result: any) => {
      if (result.id) entryIds.push(result.id);
    });
  }

  return [...new Set(entryIds)]; // Remove duplicates
}

function applyDependencyContext(step: AnalysisStep, dependencyContext: any, requestId: string): AnalysisStep {
  if (!step.resultContext || Object.keys(dependencyContext).length === 0) {
    return step; // No context to apply
  }

  const enhancedStep = { ...step };

  // Apply entry IDs from dependencies to SQL queries
  if (step.sqlQuery && step.resultContext) {
    const entryIds = Object.values(dependencyContext)
      .flatMap((dep: any) => dep.entryIds || [])
      .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

    if (entryIds.length > 0) {
      console.log(`[${requestId}] Applying ${entryIds.length} entry IDs from dependencies to SQL query`);
      
      // Modify SQL query to filter by entry IDs
      if (step.sqlQuery.includes('WHERE')) {
        enhancedStep.sqlQuery = step.sqlQuery.replace(
          /WHERE\s+/i, 
          `WHERE id = ANY(ARRAY[${entryIds.map(id => `'${id}'`).join(',')}]) AND `
        );
      } else {
        enhancedStep.sqlQuery = step.sqlQuery.replace(
          /FROM\s+"Journal Entries"/i,
          `FROM "Journal Entries" WHERE id = ANY(ARRAY[${entryIds.map(id => `'${id}'`).join(',')}])`
        );
      }
    }
  }

  return enhancedStep;
}

async function executeVectorSearch(step: any, userId: string, supabaseClient: any, requestId: string, executionDetails: any) {
  try {
    // Enhanced vector operations validation
    const vectorTestPassed = await testVectorOperations(supabaseClient, requestId);
    executionDetails.testPassed = vectorTestPassed;
    
    if (!vectorTestPassed) {
      console.warn(`[${requestId}] Vector operations validation failed, falling back to SQL search`);
      executionDetails.fallbackUsed = true;
      executionDetails.fallbackReason = 'Vector operations test failed';
      return await executeBasicSQLQuery(userId, supabaseClient, requestId);
    }
    
    console.log(`[${requestId}] Vector operations validated successfully, proceeding with vector search`);

    const embedding = await generateEmbedding(step.vectorSearch.query);
    
    let vectorResults;
    // Lowered default threshold for better recall, with fallback reduction
    const primaryThreshold = step.vectorSearch.threshold || 0.2;
    const fallbackThreshold = 0.15;
    
    console.log(`[${requestId}] Vector search with primary threshold: ${primaryThreshold}`);
    
    if (step.timeRange) {
      // Use time-filtered vector search
      const { data, error } = await supabaseClient.rpc('match_journal_entries_with_date', {
        query_embedding: embedding,
        match_threshold: primaryThreshold,
        match_count: step.vectorSearch.limit || 15,
        user_id_filter: userId,
        start_date: step.timeRange.start || null,
        end_date: step.timeRange.end || null
      });

      if (error) {
        console.error(`[${requestId}] Time-filtered vector search error:`, error);
        executionDetails.executionError = error.message;
        executionDetails.fallbackUsed = true;
        return await executeBasicSQLQuery(userId, supabaseClient, requestId);
      }
      vectorResults = data;
    } else {
      // Use standard vector search
      const { data, error } = await supabaseClient.rpc('match_journal_entries', {
        query_embedding: embedding,
        match_threshold: primaryThreshold,
        match_count: step.vectorSearch.limit || 15,
        user_id_filter: userId
      });

      if (error) {
        console.error(`[${requestId}] Vector search error:`, error);
        executionDetails.executionError = error.message;
        executionDetails.fallbackUsed = true;
        return await executeBasicSQLQuery(userId, supabaseClient, requestId);
      }
      vectorResults = data;
    }

    // Add fallback threshold reduction if no results found
    if (!vectorResults || vectorResults.length === 0) {
      console.log(`[${requestId}] No results with threshold ${primaryThreshold}, trying fallback threshold ${fallbackThreshold}`);
      
      const fallbackSearch = step.timeRange 
        ? await supabaseClient.rpc('match_journal_entries_with_date', {
            query_embedding: embedding,
            match_threshold: fallbackThreshold,
            match_count: step.vectorSearch.limit || 15,
            user_id_filter: userId,
            start_date: step.timeRange.start || null,
            end_date: step.timeRange.end || null
          })
        : await supabaseClient.rpc('match_journal_entries', {
            query_embedding: embedding,
            match_threshold: fallbackThreshold,
            match_count: step.vectorSearch.limit || 15,
            user_id_filter: userId
          });

      if (fallbackSearch.error) {
        console.error(`[${requestId}] Fallback vector search error:`, fallbackSearch.error);
        executionDetails.executionError = fallbackSearch.error.message;
        executionDetails.fallbackUsed = true;
        // Final fallback to basic SQL only if vector search completely fails
        console.log(`[${requestId}] Vector search failed completely, using basic SQL as last resort`);
        return await executeBasicSQLQuery(userId, supabaseClient, requestId);
      }

      vectorResults = fallbackSearch.data;
      
      if (vectorResults && vectorResults.length > 0) {
        console.log(`[${requestId}] Fallback threshold search found ${vectorResults.length} results`);
      }
    }

    console.log(`[${requestId}] Vector search results:`, vectorResults?.length || 0);
    return vectorResults || [];

  } catch (error) {
    console.error(`[${requestId}] Error in vector search:`, error);
    executionDetails.executionError = error.message;
    executionDetails.fallbackUsed = true;
    return await executeBasicSQLQuery(userId, supabaseClient, requestId);
  }
}

function validateSQLQuery(query: string, requestId: string): { isValid: boolean; errors: string[] } {
  const restrictedColumns = [
    '"transcription text"',
    'transcription text',
    '"foreign key"', 
    'foreign key',
    '"audio_url"',
    'audio_url',
    '"user_feedback"',
    'user_feedback', 
    '"edit_status"',
    'edit_status',
    '"translation_status"',
    'translation_status'
  ];
  
  const errors: string[] = [];
  const queryLower = query.toLowerCase();
  
  for (const restrictedCol of restrictedColumns) {
    if (queryLower.includes(restrictedCol.toLowerCase())) {
      errors.push(`Restricted column detected: ${restrictedCol}`);
      console.error(`[${requestId}] COLUMN RESTRICTION VIOLATION: ${restrictedCol} found in query`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

async function executeSQLAnalysis(step: any, userId: string, supabaseClient: any, requestId: string, executionDetails: any) {
  try {
    console.log(`[${requestId}] Executing SQL query:`, step.sqlQuery);
    
    if (!step.sqlQuery || !step.sqlQuery.trim()) {
      console.log(`[${requestId}] No SQL query provided, using vector search fallback`);
      executionDetails.fallbackUsed = true;
      return await executeVectorSearchFallback(step, userId, supabaseClient, requestId);
    }

    const originalQuery = step.sqlQuery.trim();
    executionDetails.originalQuery = originalQuery;
    
    // Validate SQL query for restricted columns
    const validation = validateSQLQuery(originalQuery, requestId);
    executionDetails.validationResult = validation;
    
    if (!validation.isValid) {
      console.error(`[${requestId}] SQL query validation failed:`, validation.errors);
      executionDetails.executionError = `Query contains restricted columns: ${validation.errors.join(', ')}`;
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

async function executeBasicSQLQuery(userId: string, supabaseClient: any, requestId: string) {
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

async function executeHybridSearch(step: any, userId: string, supabaseClient: any, requestId: string, sqlExecutionDetails: any, vectorExecutionDetails: any) {
  try {
    // Execute both vector and SQL searches in parallel
    const [vectorResults, sqlResults] = await Promise.all([
      executeVectorSearch(step, userId, supabaseClient, requestId, vectorExecutionDetails),
      executeSQLAnalysis(step, userId, supabaseClient, requestId, sqlExecutionDetails)
    ]);

    console.log(`[${requestId}] Hybrid search results - Vector: ${vectorResults?.length || 0}, SQL: ${sqlResults?.length || 0}`);
    
    return {
      vectorResults: vectorResults || [],
      sqlResults: sqlResults || []
    };

  } catch (error) {
    console.error(`[${requestId}] Error in hybrid search:`, error);
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
 * Enhanced Analyst Agent with improved SQL generation and error handling
 */
async function analyzeQueryWithSubQuestions(message, conversationContext, userEntryCount, isFollowUp = false, supabaseClient, userTimezone = 'UTC') {
  try {
    const last = Array.isArray(conversationContext) ? conversationContext.slice(-6) : [];
    
    console.log(`[Analyst Agent] Processing query with user timezone: ${userTimezone}`);
    
    // Get live database schema with real themes and emotions using the authenticated client
    const databaseSchemaContext = await generateDatabaseSchemaContext(supabaseClient);

    const contentSeekingPatterns = [
      // Direct content queries
      /\b(what did i write|what did i say|what did i journal|show me|tell me about|find|entries about)\b/i,
      /\b(content|text|wrote|said|mentioned|discussed|talked about)\b/i,
      
      // Emotional and reflective queries
      /\b(how (was|am) i feeling|what was going through my mind|emotional state|mood)\b/i,
      /\b(reflect|reflection|introspect|self-awareness|personal growth)\b/i,
      
      // Comparative and similarity queries
      /\b(similar to|like when i|reminds me of|compare|comparison|patterns like)\b/i,
      /\b(times when|occasions|moments|experiences like)\b/i,
      
      // Thematic and exploratory queries  
      /\b(themes around|insights about|patterns in|explore|analyze|analysis)\b/i,
      /\b(thoughts on|feelings about|perspective on|views on)\b/i,
      
      // Example and sample seeking
      /\b(examples|instances|cases|samples|excerpts|quotes)\b/i,
      /\b(give me|show me|find me|list)\b/i,
      
      // Achievement and progress queries
      /\b(achievement|progress|accomplishment|success|breakthrough|milestone)\b/i,
      /\b(what i achieved|how i grew|what i learned|realizations)\b/i
    ];

    const isContentSeekingQuery = contentSeekingPatterns.some(pattern => pattern.test(message.toLowerCase()));

    // Enhanced patterns for queries that MANDATE vector search regardless of time components
    const mandatoryVectorPatterns = [
      /\b(exactly|specifically|precisely|detailed|in-depth)\b/i,
      /\b(achievement|reflection|insights?|realizations?|breakthroughs?)\b/i,
      /\b(how do i feel|what emotions|emotional journey|mental state)\b/i,
      /\b(creative|inspirational|meaningful|significant|important)\b/i,
      /\b(personal growth|self-discovery|learning|wisdom|understanding)\b/i
    ];

    const requiresMandatoryVector = mandatoryVectorPatterns.some(pattern => pattern.test(message.toLowerCase()));

    // Detect personal pronouns for personalized queries
    const hasPersonalPronouns = /\b(i|me|my|mine|myself)\b/i.test(message.toLowerCase());

    // Enhanced time reference detection
    const hasExplicitTimeReference = /\b(last week|yesterday|this week|last month|today|recently|lately|this morning|last night|august|january|february|march|april|may|june|july|september|october|november|december)\b/i.test(message.toLowerCase());

    // Detect follow-up context queries
    const isFollowUpContext = isFollowUp || /\b(that|those|it|this|these|above|mentioned|said|talked about)\b/i.test(message.toLowerCase());
    
    console.log(`[Analyst Agent] Enhanced analysis - Content-seeking: ${isContentSeekingQuery}, Mandatory vector: ${requiresMandatoryVector}, Personal: ${hasPersonalPronouns}, Time ref: ${hasExplicitTimeReference}, Follow-up: ${isFollowUpContext}`);

    const prompt = `You are SOULo's Enhanced Analyst Agent - an intelligent query planning specialist for journal data analysis.

${databaseSchemaContext}

**CRITICAL DATABASE CONTEXT ADHERENCE:**
- You MUST ONLY use table names, column names, and data types that exist in the database schema above
- DO NOT hallucinate or invent table structures, column names, or data types
- STICK STRICTLY to the provided database schema context

SUB-QUESTION/QUERIES GENERATION GUIDELINE: 
- Break down user query into ATLEAST 2 sub-questions that can be consolidated to answer the user's ASK 
- CRITICAL: When analyzing vague queries, look at the FULL conversation context to understand what the user wants
- For eg. "What % of entries contain confidence when I deal with family and health?" -> sub question 1: How many entries concern family and health? sub question 2: What are all the emotions and their avg scores? sub question 3: Rank the emotions

**ENHANCED SQL QUERY GENERATION GUIDELINES:**

1. **UUID and User ID Requirements:**
   - ALWAYS use auth.uid() for user filtering (it will be replaced with the actual UUID)
   - Example: WHERE user_id = auth.uid()

2. **Table and Column References:**
   - Use "Journal Entries" (with quotes) for the table name
   - FORBIDDEN COLUMNS (NEVER USE): "transcription text", "foreign key", "audio_url", "user_feedback", "edit_status", "translation_status"
   - Valid columns: user_id, created_at, "refined text", emotions, master_themes, entities, sentiment, themeemotion, themes, duration
   - Use "refined text" for content analysis (NEVER use transcription text)

3. **JSON Operations on emotions/entities columns:**
   - For emotions: jsonb_each(emotions) to expand, emotions->>'emotion_name' for specific values
   - For entities: jsonb_each(entities) for types, jsonb_array_elements_text() for values

4. **TIME RANGE INTEGRATION:**
   - When timeRange is provided in the step, SQL queries MUST include the date filters
   - Use proper timestamp with time zone format: '2024-08-01T00:00:00Z'::timestamp with time zone
   - Example: AND created_at >= 'START_DATE' AND created_at <= 'END_DATE'

5. **Safe Query Patterns:**
   - Always include user_id = auth.uid() in WHERE clause
   - Use proper PostgreSQL syntax with double quotes for table/column names with spaces
   - Use standard aggregation functions: COUNT, AVG, MAX, MIN, SUM

**WORKING SQL EXAMPLES:**

1. **Basic Entry Query:**
\`\`\`sql
SELECT user_id, created_at, "refined text" as content, emotions, master_themes 
FROM "Journal Entries" 
WHERE user_id = auth.uid() 
ORDER BY created_at DESC 
LIMIT 10;
\`\`\`

2. **Emotion Analysis:**
\`\`\`sql
SELECT 
  emotion_key,
  AVG((emotion_value::text)::numeric) as avg_score,
  COUNT(*) as frequency
FROM "Journal Entries", 
     jsonb_each(emotions) as e(emotion_key, emotion_value)
WHERE user_id = auth.uid() 
  AND emotions IS NOT NULL
GROUP BY emotion_key
ORDER BY avg_score DESC
LIMIT 5;
\`\`\`

**VECTOR SEARCH RULES:**

1. **MANDATORY VECTOR SEARCH SCENARIOS**:
   - ANY query asking for "content", "what I wrote", "what I said", "entries about", "show me", "find"
   - Questions seeking emotional context, feelings, moods, or mental states
   - Requests for examples, patterns, insights, or thematic analysis  
   - Queries about achievements, progress, breakthroughs, or personal growth
   - Any query with words: "exactly", "specifically", "precisely", "detailed", "in-depth"

2. **VECTOR QUERY GENERATION**:
   - Use the user's EXACT words and emotional context in vector searches
   - For "What did I journal in August" → Vector query: "journal entries personal thoughts feelings experiences august"
   - For achievement queries → Vector query: "achievement success accomplishment progress breakthrough proud"

USER QUERY: "${message}"
USER TIMEZONE: "${userTimezone}"
CONTEXT: ${last.length > 0 ? last.map(m => `${m.sender}: ${m.content || 'N/A'}`).join(' | ') : 'None'}

ANALYSIS REQUIREMENTS:
- Content-seeking detected: ${isContentSeekingQuery}
- Mandatory vector required: ${requiresMandatoryVector}  

Generate a comprehensive analysis plan that:
1. MANDATES vector search for any content-seeking scenario
2. Uses hybrid approach (SQL + vector) for time-based content queries
3. Creates semantically rich vector search queries using user's language
4. Generates COMPLETE, SAFE, EXECUTABLE SQL queries using ONLY the provided database schema
5. NEVER references forbidden columns
6. Uses "refined text" as the primary content source
7. Ensures comprehensive coverage of user's intent

Response format (MUST be valid JSON):
{
  "strategy": "intelligent_sub_query|comprehensive_hybrid|vector_mandatory",
  "subQuestions": [
    {
      "id": "sq1",
      "question": "Specific sub-question",
      "executionStage": 1,
      "dependencies": ["sq1", "sq2"] or [],
      "analysisSteps": [
        {
          "queryType": "vector_search|sql_analysis|hybrid_search",
          "sqlQuery": "COMPLETE EXECUTABLE SQL QUERY using only existing database schema" or null,
          "vectorSearch": {
            "query": "Semantically rich search query using user's words",
            "threshold": 0.3,
            "limit": 15
          } or null,
          "timeRange": {"start": "ISO_DATE", "end": "ISO_DATE", "timezone": "${userTimezone}"} or null
        }
      ]
    }
  ],
  "confidence": 0.8,
  "reasoning": "Explanation of strategy with emphasis on dependency management and execution orchestration",
  "userTimezone": "${userTimezone}"
}`;

    console.log(`[Analyst Agent] Calling OpenAI API with optimized prompt`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini-2025-04-14', // Using gpt-4.1-mini for reliable query planning
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }, // Enforce strict JSON mode
        max_tokens: 1000, // Token limit for GPT-4.1-mini
        temperature: 0.1 // Low temperature for consistent responses
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Analyst Agent] OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const rawResponse = data.choices[0].message.content;
    console.log("Analyst Agent raw response:", rawResponse?.substring(0, 500) || 'empty');

    let analysisResult;
    try {
      // Enhanced JSON parsing with better error handling
      if (!rawResponse || rawResponse.trim().length === 0) {
        console.error("[Analyst Agent] Empty response from OpenAI");
        return createEnhancedFallbackPlan(message, isContentSeekingQuery || requiresMandatoryVector, null, supabaseClient, userTimezone);
      }

      // Direct JSON parsing since we enforce JSON mode
      analysisResult = JSON.parse(rawResponse);
      console.log("[Analyst Agent] Successfully parsed JSON response");
    } catch (parseError) {
      console.error("Failed to parse Analyst Agent response:", parseError);
      console.error("Raw response:", rawResponse);
      
      // Try using response_format: json_object for next attempt
      console.log("[Analyst Agent] Attempting JSON object format retry");
      try {
        const retryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4.1-mini-2025-04-14',
            messages: [
              { role: 'system', content: 'You are a precise query analyzer. Return only valid JSON that matches the exact schema.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            max_completion_tokens: 2000
          }),
        });
        
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          const retryRawResponse = retryData.choices[0].message.content;
          analysisResult = JSON.parse(retryRawResponse);
          console.log("[Analyst Agent] Successfully parsed JSON on retry");
        } else {
          throw new Error('Retry also failed');
        }
      } catch (retryError) {
        console.error("JSON retry also failed:", retryError);
        return createEnhancedFallbackPlan(message, isContentSeekingQuery || requiresMandatoryVector, null, supabaseClient, userTimezone);
      }
    }

    if (!analysisResult || !analysisResult.subQuestions) {
      console.error("Analyst Agent response missing subQuestions, using enhanced fallback");
      return createEnhancedFallbackPlan(message, isContentSeekingQuery || requiresMandatoryVector, null, supabaseClient, userTimezone);
    }

    // Force vector search for content-seeking queries and ensure timezone info
    if (isContentSeekingQuery || requiresMandatoryVector) {
      analysisResult.subQuestions.forEach(subQ => {
        if (subQ.searchStrategy !== 'vector_mandatory' && subQ.searchStrategy !== 'hybrid_parallel') {
          subQ.searchStrategy = 'vector_mandatory';
          subQ.analysisSteps.forEach(step => {
            if (!step.vectorSearch) {
              step.vectorSearch = {
                query: `${message} personal journal content experiences thoughts feelings`,
                threshold: 0.3,
                limit: 15
              };
              step.queryType = step.queryType === 'sql_analysis' ? 'hybrid_search' : 'vector_search';
            }
            // Ensure timezone is included in timeRange
            if (step.timeRange && !step.timeRange.timezone) {
              step.timeRange.timezone = userTimezone;
            }
          });
        }
      });
    }

    // Enhance with detected characteristics and timezone
    const finalResult = {
      ...analysisResult,
      useAllEntries: analysisResult.useAllEntries !== false,
      hasPersonalPronouns,
      hasExplicitTimeReference: false, // Override to false to prevent time-only strategies
      inferredTimeContext: null,
      userTimezone
    };

    console.log("Final Analyst Plan with enhanced SQL generation:", JSON.stringify(finalResult, null, 2));
    return finalResult;

  } catch (error) {
    console.error("Error in Analyst Agent:", error);
    return createEnhancedFallbackPlan(message, true, null, supabaseClient, userTimezone); // Default to content-seeking
  }
}

/**
 * Create enhanced fallback plan with mandatory vector search and timezone handling
 */
function createEnhancedFallbackPlan(originalMessage, isContentSeekingQuery, inferredTimeContext, supabaseClient, userTimezone = 'UTC') {
  const lowerMessage = originalMessage.toLowerCase();
  const isEmotionQuery = /emotion|feel|mood|happy|sad|anxious|stressed|emotional/.test(lowerMessage);
  const isThemeQuery = /work|relationship|family|health|goal|travel|career|friendship/.test(lowerMessage);
  const isAchievementQuery = /achievement|progress|accomplishment|success|breakthrough|growth|proud/.test(lowerMessage);

  // Always use vector search for content-seeking queries
  const searchStrategy = isContentSeekingQuery ? 'vector_mandatory' : 'hybrid_parallel';
  
  // Create semantically rich vector query
  let vectorQuery = originalMessage;
  if (isEmotionQuery) {
    vectorQuery += " emotions feelings emotional state mood mental health";
  }
  if (isThemeQuery) {
    vectorQuery += " themes life experiences personal growth";
  }
  if (isAchievementQuery) {
    vectorQuery += " achievements success accomplishments progress breakthroughs";
  }

  // Ensure timezone is included in timeRange if provided
  if (inferredTimeContext && !inferredTimeContext.timezone) {
    inferredTimeContext.timezone = userTimezone;
  }

  return {
    queryType: "journal_specific",
    strategy: "enhanced_fallback_with_vector",
    userStatusMessage: isContentSeekingQuery ? "Semantic content search with enhanced vector analysis" : "Intelligent hybrid search strategy",
    subQuestions: [
      {
        id: "sq1",
        question: `Enhanced analysis for: ${originalMessage}`,
        purpose: "Comprehensive content retrieval using vector semantic search for accurate results",
        searchStrategy: searchStrategy,
        executionStage: 1,
        dependencies: [],
        executionMode: "parallel",
        analysisSteps: [
          {
            step: 1,
            description: "Enhanced vector semantic search with user's exact query context",
            queryType: "vector_search",
            sqlQuery: null,
            vectorSearch: {
              query: vectorQuery,
              threshold: 0.3,
              limit: 15
            },
            timeRange: inferredTimeContext ? { ...inferredTimeContext, timezone: userTimezone } : null,
            dependencies: []
          }
        ]
      }
    ],
    confidence: 0.7,
    reasoning: `Enhanced fallback plan using mandatory vector search for content-seeking query: "${originalMessage}". This ensures semantic understanding and comprehensive content retrieval with proper timezone handling.`,
    useAllEntries: true,
    hasPersonalPronouns: /\b(i|me|my|mine|myself)\b/i.test(lowerMessage),
    hasExplicitTimeReference: false, // Override to ensure vector search
    inferredTimeContext: inferredTimeContext,
    userTimezone
  };
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
    const executionResult = await executePlan(analysisResult, userId, supabaseClient, requestId);
    
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
