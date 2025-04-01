import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import OpenAI from "https://deno.land/x/openai@v4.27.0/mod.ts";
import { DOMParser } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openai = new OpenAI(openAIApiKey);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Utility function to extract text content from HTML
function extractTextFromHTML(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc ? doc.body.textContent : '';
}

// Utility function to count journal entries for a user
async function countJournalEntries(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('Journal Entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error("Error counting journal entries:", error);
    return 0;
  }

  return count || 0;
}

// Utility function to get date range based on time range
function getDateRangeForTimeframe(timeframe: string): { startDate: string, endDate: string } {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();

  // Set end date to current time
  endDate = now;

  // Calculate start date based on timeframe
  if (timeframe === 'last month' || timeframe === 'previous month') {
    // First day of previous month
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // Last day of previous month
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (timeframe === 'this month' || timeframe === 'current month') {
    // First day of current month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    // Current day
    endDate = now;
  } else if (timeframe === 'last week' || timeframe === 'previous week') {
    // Start of previous week (Monday)
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) - 7;
    startDate = new Date(now.getFullYear(), now.getMonth(), diff);
    // End of previous week (Sunday)
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  } else if (timeframe === 'this week' || timeframe === 'current week') {
    // Start of current week (Monday)
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startDate = new Date(now.getFullYear(), now.getMonth(), diff);
    // Current day
    endDate = now;
  } else if (timeframe === 'yesterday') {
    // Yesterday
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
  } else if (timeframe === 'today') {
    // Today
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    endDate = now;
  } else if (timeframe === 'last year' || timeframe === 'previous year') {
    // Last year
    startDate = new Date(now.getFullYear() - 1, 0, 1);
    endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  } else if (timeframe === 'this year' || timeframe === 'current year') {
    // This year
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = now;
  } else {
    // Default to last 30 days if timeframe not recognized
    startDate = new Date();
    startDate.setDate(now.getDate() - 30);
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
}

// Utility function to analyze the query using OpenAI
async function generateQueryAnalysis(message: string, entryCount: number) {
  try {
    const prompt = `You are an expert query analyzer for a personal journal application. Your task is to analyze user queries and create a structured plan for retrieving relevant information from a database.
      
      Here's how you should respond:
      - goal: A concise statement of what the user is trying to find out.
      - context: Important background information or entities mentioned in the query.
      - intent: The specific action or information the user is seeking (e.g., "find entries about a specific event," "summarize emotions related to a person," "compare different time periods").
      - entities: A list of key entities (people, places, events, etc.) mentioned in the query.
      - time_range: The time period the user is interested in (e.g., "last week," "specific date," "past year").
      - filters: Specific criteria to narrow down the search (e.g., "entries with a specific emotion," "entries related to a particular theme").
      - data_requirements: The specific data fields needed to answer the query (e.g., "entry text," "emotions," "themes," "entities").
      - execution_plan: A step-by-step plan for retrieving the necessary information from the database. Each step should include:
        - step: A brief description of the step.
        - step_type: The type of operation to perform ("sql_query," "data_aggregation," "data_filtering," etc.).
        - sql_query: A SQL query to retrieve the necessary data (if applicable).
        - data_fields: The data fields to retrieve in the query.
        - filters: Any filters to apply to the query.
        - dynamic_query: true or false, if the query needs dynamic values
      - expected_response_format: A description of how the final response should be formatted.
      
      IMPORTANT: The database table name is "Journal Entries" (with a space and capital letters), not "journal_entries". Always use double quotes around the table name in SQL queries.

      IMPORTANT: For emotion-related queries, ensure that your SQL query directly extracts and formats emotion data rather than just returning journal entry IDs. 
      Use SQL functions to process the emotion data within the query whenever possible.
      
      Example:
      User Query: "How did I feel about my friend Sarah last week?"
      
      Response:
      {
        "goal": "Understand the user's feelings about their friend Sarah last week.",
        "context": "The user is asking about their feelings in relation to their friend Sarah.",
        "intent": "Summarize emotions related to a person.",
        "entities": ["Sarah"],
        "time_range": "Last week",
        "filters": ["Entries related to Sarah", "Entries from last week"],
        "data_requirements": ["Entry text", "Emotions"],
        "execution_plan": [
          {
            "step": "Retrieve all journal entries related to Sarah from last week.",
            "step_type": "sql_query",
            "sql_query": "SELECT id, \\"refined text\\" as text, emotions FROM \\"Journal Entries\\" WHERE user_id = $1 AND entities LIKE '%Sarah%' AND created_at >= __LAST_WEEK_START__ AND created_at <= __LAST_WEEK_END__",
            "data_fields": ["id", "text", "emotions"],
            "filters": ["user_id", "entities", "date"],
            "dynamic_query": false
          },
          {
            "step": "Aggregate the emotions expressed in the retrieved entries.",
            "step_type": "data_aggregation",
            "data_fields": ["emotions"],
            "filters": [],
            "dynamic_query": false
          }
        ],
        "expected_response_format": "A summary of the user's feelings about Sarah last week, based on the emotions expressed in their journal entries."
      }
      
      Now, analyze the following query. Keep the analysis concise and use valid JSON format.
      Remember to use "Journal Entries" (with double quotes) as the table name in all SQL queries.
      IMPORTANT: For time-based queries, use the following date variables instead of hardcoded strings:
      - __LAST_MONTH_START__ and __LAST_MONTH_END__ for last month
      - __LAST_WEEK_START__ and __LAST_WEEK_END__ for last week
      - __CURRENT_MONTH_START__ for current month start
      - Do NOT use 'start_date' or 'end_date' as literal strings
      
      User Query: "${message}"
      
      Available journal entries: ${entryCount}
      `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    console.error("Error generating query analysis:", error);
    return { error: error.message };
  }
}

// Utility function to process emotion data
async function processEmotionData(journalEntries: any[], timeframe: string): Promise<{emotionsList: string, topEmotions: [string, number][], explanation?: string}> {
  // Extract and aggregate emotion data from entries
  const emotionCounts: {[key: string]: {count: number, total: number, entries: any[]}} = {};
  
  journalEntries.forEach(entry => {
    if (entry.emotions && typeof entry.emotions === 'object') {
      Object.entries(entry.emotions).forEach(([emotion, score]) => {
        if (!emotionCounts[emotion]) {
          emotionCounts[emotion] = { count: 0, total: 0, entries: [] };
        }
        emotionCounts[emotion].count += 1;
        emotionCounts[emotion].total += Number(score);
        emotionCounts[emotion].entries.push(entry);
      });
    }
  });
  
  // Get the top emotions
  const topEmotions = Object.entries(emotionCounts)
    .sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
      return (b[1].total / b[1].count) - (a[1].total / a[1].count);
    })
    .slice(0, 3)
    .map(([emotion, stats]) => {
      const avgScore = (stats.total / stats.count).toFixed(2);
      return [emotion, Number(avgScore)] as [string, number];
    });
  
  // Format the emotion list
  const emotionsList = topEmotions.map(([emotion, score]) => 
    `${emotion} (${score})`
  ).join(', ');
  
  return {
    emotionsList,
    topEmotions,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, includeDiagnostics = false, enableQueryBreakdown = false, generateSqlQueries = false, analyzeComponents = false, allowRetry = true, requiresExplanation = false } = await req.json();

    if (!message || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const entryCount = await countJournalEntries(userId);
    if (entryCount === 0) {
      return new Response(
        JSON.stringify({
          response: "It looks like you haven't written any journal entries yet. Once you do, I can help you analyze them!",
          hasNumericResult: false,
          fallbackToRag: false,
          diagnostics: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();
    console.log(`Generating detailed query analysis for "${message}" with ${entryCount} entries available`);

    const queryAnalysisPlan = await generateQueryAnalysis(message, entryCount);
    if (queryAnalysisPlan.error) {
      console.error("Query analysis error:", queryAnalysisPlan.error);
      return new Response(
        JSON.stringify({
          error: queryAnalysisPlan.error,
          response: "I'm sorry, I had trouble understanding your request. Please try again with a simpler query.",
          hasNumericResult: false,
          fallbackToRag: true,
          diagnostics: includeDiagnostics ? {
            queryAnalysis: queryAnalysisPlan,
            generationTime: Date.now() - startTime
          } : null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const executionResults = [];
    const executionErrors = [];
    let needsRetry = false;
    let retryAttempted = 0;
    const MAX_RETRY_ATTEMPTS = 2;
    
    // Detect if this is an emotion-focused query
    const isEmotionQuery = message.toLowerCase().includes('emotion') || 
                          message.toLowerCase().includes('feel') ||
                          message.toLowerCase().includes('sad') || 
                          message.toLowerCase().includes('happy') ||
                          message.toLowerCase().includes('angry') ||
                          (queryAnalysisPlan.intent && 
                           queryAnalysisPlan.intent.toLowerCase().includes('emotion'));
    
    if (queryAnalysisPlan.execution_plan) {
      for (const step of queryAnalysisPlan.execution_plan) {
        console.log(`Executing step: ${step.step} (${step.step_type})`);
        
        if (step.step_type === 'sql_query' && step.sql_query) {
          let cleanedQuery = step.sql_query.trim().replace(/;$/, '');
          
          // Fix JSONB LIKE queries - replace with proper JSONB containment operators
          if (cleanedQuery.includes('emotions LIKE') || cleanedQuery.includes('emotions ILIKE')) {
            // Extract the emotion term we're searching for
            const emotionMatch = cleanedQuery.match(/emotions (?:I?LIKE) '%(\w+)%'/i);
            if (emotionMatch && emotionMatch[1]) {
              const emotionTerm = emotionMatch[1].toLowerCase();
              
              // Replace the LIKE operator with proper JSONB query
              cleanedQuery = cleanedQuery.replace(
                /emotions (?:I?LIKE) '%\w+%'/i,
                `(emotions ? '${emotionTerm}' OR emotions::text ILIKE '%${emotionTerm}%')`
              );
              
              console.log(`Fixed emotion query for "${emotionTerm}": ${cleanedQuery}`);
            }
          }
          
          // Replace time variables with actual date values
          if (queryAnalysisPlan.time_range && typeof queryAnalysisPlan.time_range === 'string') {
            const timeRange = queryAnalysisPlan.time_range.toLowerCase();
            const dateRange = getDateRangeForTimeframe(timeRange);
            
            // These replacements will happen inside the execute_dynamic_query function
            console.log(`Using time range: ${timeRange}, Start: ${dateRange.startDate}, End: ${dateRange.endDate}`);
          }
          
          try {
            let result;
            let currentRetryAttempt = 0;
            let lastError = null;
            
            // Try executing the query, with retries if allowed
            while (currentRetryAttempt <= MAX_RETRY_ATTEMPTS) {
              try {
                if (step.dynamic_query) {
                  const dynamicValues = { userId };
                  let dynamicQuery = cleanedQuery;
                  for (const [key, value] of Object.entries(dynamicValues)) {
                    dynamicQuery = dynamicQuery.replace(new RegExp(`\\$\\$${key}\\$\\$`, 'g'), value);
                  }
                  result = await executeDirectSqlQuery(dynamicQuery, userId);
                } else {
                  result = await executeDirectSqlQuery(cleanedQuery, userId);
                }
                
                console.log(`SQL result for step "${step.step}":`, JSON.stringify(result).substring(0, 200) + "...");
                executionResults.push({ step: step.step, result });
                
                // If we got here, the query was successful, so break out of retry loop
                break;
              } catch (sqlError) {
                lastError = sqlError;
                
                // Special handling for emotion queries that failed
                if (isEmotionQuery && sqlError.message && sqlError.message.includes('operator does not exist: jsonb')) {
                  console.log("Detected error with emotion JSONB query, using alternative approach");
                  
                  try {
                    // Use the dedicated get_top_emotions function instead
                    const { data: emotionData, error: emotionError } = await supabase.rpc(
                      'get_top_emotions',
                      { 
                        user_id_param: userId,
                        limit_count: 3
                      }
                    );
                    
                    if (!emotionError && emotionData) {
                      console.log("Successfully retrieved emotions using specialized function:", emotionData);
                      result = emotionData;
                      executionResults.push({ 
                        step: "Get top emotions", 
                        result: emotionData.map((item: any) => ({
                          emotion: item.emotion,
                          score: item.score
                        }))
                      });
                      break; // Exit retry loop on success
                    }
                  } catch (emotionFunctionError) {
                    console.error("Error using get_top_emotions function:", emotionFunctionError);
                  }
                }
                
                if (allowRetry && currentRetryAttempt < MAX_RETRY_ATTEMPTS) {
                  console.error(`SQL error for step "${step.step}" (attempt ${currentRetryAttempt + 1}):`, sqlError);
                  
                  // Generate improved SQL query for next attempt
                  try {
                    console.log(`Attempting to regenerate improved SQL query...`);
                    const improvedQuery = await regenerateImprovedSqlQuery(cleanedQuery, sqlError.message, message);
                    
                    if (improvedQuery) {
                      console.log(`Generated improved SQL query: ${improvedQuery}`);
                      cleanedQuery = improvedQuery; // Use the improved query for the next retry
                      currentRetryAttempt++;
                      retryAttempted++;
                      needsRetry = true;
                      continue; // Try again with the improved query
                    }
                  } catch (retryGenError) {
                    console.error("Error generating retry query:", retryGenError);
                  }
                }
                
                // If we got here, either retries are not allowed or all retries failed
                console.error(`Final SQL error for step "${step.step}":`, lastError);
                executionErrors.push({ step: step.step, error: lastError });
                
                // For emotion queries that failed completely, let's try one more fallback approach
                if (isEmotionQuery && message.toLowerCase().includes('sad')) {
                  try {
                    // Direct simple query for entries with emotions containing 'sad'
                    const { data: sadEntries, error: sadError } = await supabase
                      .from('Journal Entries')
                      .select('id, "refined text", emotions, created_at')
                      .eq('user_id', userId)
                      .filter('emotions', 'neq', null)
                      .order('created_at', { ascending: false });
                      
                    if (!sadError && sadEntries && sadEntries.length > 0) {
                      // Filter entries with sad emotion manually
                      const entriesWithSadness = sadEntries.filter(entry => 
                        entry.emotions && 
                        (entry.emotions.sad || 
                         entry.emotions.sadness || 
                         JSON.stringify(entry.emotions).toLowerCase().includes('sad'))
                      );
                      
                      if (entriesWithSadness.length > 0) {
                        // Sort by sadness score if available
                        entriesWithSadness.sort((a, b) => {
                          const scoreA = a.emotions && (a.emotions.sad || a.emotions.sadness || 0);
                          const scoreB = b.emotions && (b.emotions.sad || b.emotions.sadness || 0);
                          return scoreB - scoreA;
                        });
                        
                        executionResults.push({ 
                          step: "Find entries with sadness", 
                          result: entriesWithSadness
                        });
                        break; // Exit retry loop on success
                      }
                    }
                  } catch (fallbackError) {
                    console.error("Error using fallback approach for sad entries:", fallbackError);
                  }
                }
                
                break;
              }
            }
          } catch (error) {
            console.error(`Error executing step "${step.step}":`, error);
            executionErrors.push({ step: step.step, error: error.message || String(error) });
          }
        } else if (step.step_type === 'data_aggregation') {
          // For emotion queries, let's do special processing
          if (isEmotionQuery && executionResults.length > 0) {
            const lastResult = executionResults[executionResults.length - 1];
            
            if (lastResult && lastResult.result && Array.isArray(lastResult.result)) {
              try {
                // Check if we have journal entries with emotions
                if (lastResult.result.length > 0 && 
                    lastResult.result[0] && 
                    typeof lastResult.result[0] === 'object') {
                  
                  if (lastResult.result[0].emotions) {
                    // We have journal entries with emotion data
                    const emotionData = await processEmotionData(
                      lastResult.result, 
                      queryAnalysisPlan.time_range
                    );
                    
                    executionResults.push({ 
                      step: "Process and rank emotions",
                      result: emotionData.topEmotions.map(([emotion, score]) => ({ 
                        emotion, 
                        score 
                      }))
                    });
                  } 
                  // Check if we directly have emotion objects
                  else if (lastResult.result[0].emotion || lastResult.result[0].name) {
                    // We already have processed emotion data
                    executionResults.push({ 
                      step: "Format emotion data",
                      result: lastResult.result
                    });
                  }
                  // If we just have IDs, we need to fetch the entries
                  else if (lastResult.result.every((item: any) => 
                      typeof item === 'number' || (typeof item === 'object' && item.id))) {
                    
                    // Extract IDs
                    const entryIds = lastResult.result.map((item: any) => 
                      typeof item === 'number' ? item : item.id
                    );
                    
                    // Fetch emotions for these entries
                    try {
                      const { data: entriesData, error: entriesError } = await supabase
                        .from('Journal Entries')
                        .select('id, "refined text", emotions, created_at')
                        .in('id', entryIds);
                      
                      if (!entriesError && entriesData && entriesData.length > 0) {
                        const emotionData = await processEmotionData(
                          entriesData, 
                          queryAnalysisPlan.time_range
                        );
                        
                        executionResults.push({ 
                          step: "Process and rank emotions from retrieved entries",
                          result: emotionData.topEmotions.map(([emotion, score]) => ({ 
                            emotion, 
                            score 
                          }))
                        });
                      }
                    } catch (fetchError) {
                      console.error("Error fetching emotion data for entries:", fetchError);
                      executionErrors.push({ 
                        step: "Fetch emotion data", 
                        error: fetchError.message || String(fetchError) 
                      });
                    }
                  }
                }
              } catch (emotionError) {
                console.error("Error processing emotion data:", emotionError);
                executionErrors.push({ 
                  step: "Process emotion data", 
                  error: emotionError.message || String(emotionError) 
                });
              }
            }
          } else {
            // Standard data aggregation for non-emotion queries
            const stepDependencies = step.dependencies || [];
            const stepResults = stepDependencies.map(dep => {
              const foundResult = executionResults.find(res => res.step === dep);
              return foundResult ? foundResult.result : null;
            });

            if (stepResults.every(result => result !== null)) {
              try {
                if (step.aggregation_type === 'count') {
                  const totalCount = stepResults.reduce((acc, curr) => acc + (Array.isArray(curr) ? curr.length : 0), 0);
                  executionResults.push({ step: step.step, result: totalCount });
                } else if (step.aggregation_type === 'average') {
                  const validValues = stepResults.flat().filter(val => typeof val === 'number');
                  const averageValue = validValues.length > 0 ? validValues.reduce((acc, val) => acc + val, 0) / validValues.length : 0;
                  executionResults.push({ step: step.step, result: averageValue });
                } else if (step.aggregation_type === 'sum') {
                  const validValues = stepResults.flat().filter(val => typeof val === 'number');
                  const sumValue = validValues.reduce((acc, val) => acc + val, 0);
                  executionResults.push({ step: step.step, result: sumValue });
                } else {
                  executionErrors.push({ step: step.step, error: `Unsupported aggregation type: ${step.aggregation_type}` });
                }
              } catch (aggregationError) {
                console.error(`Error during data aggregation for step "${step.step}":`, aggregationError);
                executionErrors.push({ step: step.step, error: aggregationError.message || String(aggregationError) });
              }
            } else {
              executionErrors.push({ step: step.step, error: `Missing dependencies: ${stepDependencies.join(', ')}` });
            }
          }
        }
      }
    }
    
    // Determine if we need to fall back to RAG
    let fallbackToRag = (executionErrors.length > 0 && executionResults.length === 0) || executionResults.length === 0;
    
    // If we have both results and errors, we can still potentially use the partial results
    if (executionResults.length > 0 && executionErrors.length > 0) {
      fallbackToRag = executionErrors.some(error => error.error && error.error.toString().includes("syntax error"));
    }

    let response = "I couldn't find a direct answer to your question using the available data. I will try a different approach.";
    let hasNumericResult = false;
    let references = null;

    if (executionResults.length > 0 && !fallbackToRag) {
      // Special handling for specific emotion queries like "when was I most sad"
      if (isEmotionQuery && (message.toLowerCase().includes("when") || message.toLowerCase().includes("most sad"))) {
        // Look for entries with sadness emotion
        const entriesWithEmotion = executionResults.find(res => 
          res.step.includes("Find entries with") && Array.isArray(res.result) && res.result.length > 0
        );
        
        if (entriesWithEmotion && entriesWithEmotion.result.length > 0) {
          // Find the entry with the highest sad/sadness score
          const sortedEntries = [...entriesWithEmotion.result].sort((a, b) => {
            const scoreA = a.emotions && (a.emotions.sad || a.emotions.sadness || 0);
            const scoreB = b.emotions && (b.emotions.sad || b.emotions.sadness || 0);
            return scoreB - scoreA;
          });
          
          const mostSadEntry = sortedEntries[0];
          const sadScore = mostSadEntry.emotions && (mostSadEntry.emotions.sad || mostSadEntry.emotions.sadness || 0);
          const formattedDate = new Date(mostSadEntry.created_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
          });
          
          // Create a response with the date and context
          response = `Based on your journal entries, you felt most sad on ${formattedDate}`;
          if (sadScore) {
            response += ` with a sadness intensity of ${sadScore.toFixed(2)} out of 1.0`;
          }
          response += `.`;
          
          // Add a snippet from the journal entry for context
          if (mostSadEntry["refined text"]) {
            const snippet = mostSadEntry["refined text"].substring(0, 150) + "...";
            response += ` Here's what you wrote: "${snippet}"`;
          }
          
          // Set references for UI display
          references = [{
            id: mostSadEntry.id,
            date: mostSadEntry.created_at,
            snippet: mostSadEntry["refined text"]?.substring(0, 150) + "..."
          }];
        }
      }
      // Special handling for emotion queries
      else if (isEmotionQuery) {
        const emotionResults = executionResults.find(res => 
          res.step.includes("emotion") && 
          Array.isArray(res.result) && 
          res.result.length > 0 && 
          res.result[0].emotion
        );
        
        if (emotionResults) {
          const emotionsList = emotionResults.result.map((item: any) => 
            `${item.emotion} (${typeof item.score === 'number' ? item.score.toFixed(2) : item.score})`
          ).join(', ');
          
          // Get the time period from the query analysis
          const timePeriod = queryAnalysisPlan.time_range ? 
            queryAnalysisPlan.time_range.toLowerCase() : 
            "based on your journal entries";
          
          response = `Based on your journal entries from ${timePeriod}, your top emotions were: ${emotionsList}.`;
          
          // Try to include journal entries as references
          const entriesResult = executionResults.find(res => 
            Array.isArray(res.result) && 
            res.result.length > 0 && 
            res.result[0] && 
            (res.result[0]["refined text"] || res.result[0].text)
          );
          
          if (entriesResult) {
            references = entriesResult.result.map((entry: any) => ({
              id: entry.id,
              date: entry.created_at,
              snippet: (entry["refined text"] || entry.text)?.substring(0, 150) + "..."
            }));
          }
          
          // If the query asks for "why", include explanations
          if (requiresExplanation) {
            const entriesWithEmotions = executionResults.find(res => 
              Array.isArray(res.result) && 
              res.result.some((entry: any) => entry.emotions || entry["refined text"] || entry.text)
            );
            
            if (entriesWithEmotions) {
              const topEmotions = emotionResults.result.slice(0, 2).map((item: any) => item.emotion);
              let explanations = '';
              
              // Find examples for each top emotion
              for (const emotion of topEmotions) {
                const relevantEntries = entriesWithEmotions.result
                  .filter((entry: any) => 
                    entry.emotions && 
                    entry.emotions[emotion] && 
                    entry.emotions[emotion] > 0.5 &&
                    (entry["refined text"] || entry.text)
                  )
                  .slice(0, 2);
                
                if (relevantEntries.length > 0) {
                  explanations += `\n\nYou experienced ${emotion} when: `;
                  relevantEntries.forEach((entry: any) => {
                    const snippet = (entry["refined text"] || entry.text)?.substring(0, 100) + "...";
                    if (snippet) {
                      explanations += `"${snippet}" `;
                    }
                  });
                }
              }
              
              if (explanations) {
                response += explanations;
              }
            }
          }
        } else {
          // Couldn't find structured emotion data, use a generic response
          response = "I found some emotion data in your journal entries, but I'm having trouble analyzing it in detail.";
        }
      } else {
        // Standard handling for non-emotion queries
        const finalResult = executionResults[executionResults.length - 1].result;
        if (typeof finalResult === 'number') {
          response = `The answer is: ${finalResult}`;
          hasNumericResult = true;
        } else if (Array.isArray(finalResult)) {
          if (finalResult.length > 0) {
            const firstItem = finalResult[0];
            if (typeof firstItem === 'object' && firstItem !== null) {
              const keys = Object.keys(firstItem);
              if (keys.length > 0) {
                const key = keys[0];
                response = `Here's what I found: ${finalResult.map(item => item[key]).join(', ')}`;
              } else {
                response = `Here's what I found: ${finalResult.join(', ')}`;
              }
            } else {
              response = `Here's what I found: ${finalResult.join(', ')}`;
            }
          } else {
            response = "I found some data, but it doesn't seem to contain any specific answers.";
          }
        } else if (typeof finalResult === 'string') {
          response = finalResult;
        } else if (typeof finalResult === 'boolean') {
          response = finalResult ? "Yes" : "No";
        } else if (finalResult !== null && finalResult !== undefined) {
          try {
            response = JSON.stringify(finalResult);
          } catch (stringifyError) {
            console.error("Error stringifying result:", stringifyError);
            response = "I found some data, but I'm having trouble displaying it.";
          }
        } else {
          response = "I found some data, but it doesn't seem to contain any specific answers.";
        }
      }
    }

    return new Response(
      JSON.stringify({
        response,
        hasNumericResult,
        fallbackToRag,
        retryAttempted: needsRetry,
        references,
        diagnostics: includeDiagnostics ? {
          queryAnalysis: queryAnalysisPlan,
          executionResults,
          executionErrors,
          generationTime: Date.now() - startTime,
          needsRetry,
          retryAttempted
        } : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        response: "Sorry, I encountered an error processing your request. Please try again.",
        hasNumericResult: false,
        fallbackToRag: true,
        diagnostics: null
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function regenerateImprovedSqlQuery(originalQuery, errorMessage, userQuestion) {
  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('OpenAI API key not found');
      return null;
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert SQL developer specializing in PostgreSQL and Supabase. 
            Fix SQL queries that encounter errors. Only return the fixed SQL query without any explanations or formatting.
            IMPORTANT: Don't include semicolons at the end of queries and ensure proper parameter references.
            
            The database schema includes:
            - "Journal Entries" table with columns: id, user_id, created_at, transcription_text, refined_text, emotions (JSONB), entities (JSONB), master_themes (ARRAY)
            - emotions column structure: { "happy": 0.8, "sad": 0.2, ... }
            - entities column structure: { "people": ["John", "Mary"], "places": ["New York"] }
            
            Common issues to fix:
            - Remove semicolons at the end
            - Fix JSON operators (use ->> instead of -> for text extraction)
            - Fix array functions
            - Fix parameter references ($1 is often user_id)
            - Fix table and column names (remember "Journal Entries" needs double quotes)
            - Fix time range filters (use __LAST_MONTH_START__, __LAST_MONTH_END__, __LAST_WEEK_START__, __LAST_WEEK_END__, etc.)`
          },
          {
            role: 'user',
            content: `The following SQL query failed with this error: "${errorMessage}"
            
            Original query: ${originalQuery}
            
            User was asking: "${userQuestion}"
            
            Provide only the corrected SQL query with no explanations or extra text. Replace hardcoded date strings with variables like __LAST_MONTH_START__ if appropriate. Do not use 'start_date' or 'end_date' as literal strings.`
          }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.error('Error generating improved SQL query:', await response.text());
      return null;
    }

    const result = await response.json();
    const improvedQuery = result.choices[0].message.content.trim();
    
    return improvedQuery.replace(/;$/, '');
  } catch (error) {
    console.error('Error regenerating SQL query:', error);
    return null;
  }
}

async function executeDirectSqlQuery(query, userId) {
  // Replace variables with actual dates
  const now = new Date();
  
  // Last month
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  
  // Current month
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Last week (Monday-Sunday)
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) - 7;
  const lastWeekStart = new Date(now.getFullYear(), now.getMonth(), diff);
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
  lastWeekEnd.setHours(23, 59, 59, 999);
  
  let finalQuery = query;
  
  // FIX: Correctly replace date placeholders without adding extra quotes
  finalQuery = finalQuery.replace(/__LAST_MONTH_START__/g, `'${lastMonthStart.toISOString()}'`);
  finalQuery = finalQuery.replace(/__LAST_MONTH_END__/g, `'${lastMonthEnd.toISOString()}'`);
  finalQuery = finalQuery.replace(/__CURRENT_MONTH_START__/g, `'${currentMonthStart.toISOString()}'`);
  finalQuery = finalQuery.replace(/__LAST_WEEK_START__/g, `'${lastWeekStart.toISOString()}'`);
  finalQuery = finalQuery.replace(/__LAST_WEEK_END__/g, `'${lastWeekEnd.toISOString()}'`);
  
  // FIX: Ensure that $1 is properly replaced and no extra quotes are added
  finalQuery = finalQuery.replace(/\$1/g, `'${userId}'`);
  
  try {
    console.log("Executing SQL query:", finalQuery);
    const { data, error } = await supabase.rpc('execute_dynamic_query', {
      query_text: finalQuery,
      param_values: [userId]
    });
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error executing SQL query:', error);
    throw error;
  }
}
