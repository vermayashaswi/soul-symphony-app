
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
            "sql_query": "SELECT id, \"refined text\" as text, emotions FROM \"Journal Entries\" WHERE user_id = $1 AND entities LIKE '%Sarah%' AND created_at >= 'start_date' AND created_at <= 'end_date'",
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
      
      User Query: "${message}"
      
      Available journal entries: ${entryCount}
      `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const analysis = completion.choices[0].message.content;
    console.log("Raw analysis result:", analysis);
    
    try {
      return JSON.parse(analysis);
    } catch (jsonError) {
      console.error("Failed to parse JSON analysis:", jsonError);
      console.error("Problematic JSON:", analysis);
      return { error: "Failed to parse analysis as JSON" };
    }
  } catch (error) {
    console.error("Error generating query analysis:", error);
    return { error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, includeDiagnostics = false, enableQueryBreakdown = false, generateSqlQueries = false, analyzeComponents = false, allowRetry = true } = await req.json();

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
    let retryAttempts = 0;
    const MAX_RETRY_ATTEMPTS = 2;
    
    if (queryAnalysisPlan.execution_plan) {
      for (const step of queryAnalysisPlan.execution_plan) {
        console.log(`Executing step: ${step.step} (${step.step_type})`);
        
        if (step.step_type === 'sql_query' && step.sql_query) {
          let cleanedQuery = step.sql_query.trim().replace(/;$/, '');
          
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
                needsRetry = false;
                break;
              }
            }
          } catch (error) {
            console.error(`Error executing step "${step.step}":`, error);
            executionErrors.push({ step: step.step, error: error.message || String(error) });
          }
        } else if (step.step_type === 'data_aggregation') {
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
    
    // Determine if we need to fall back to RAG
    let fallbackToRag = (executionErrors.length > 0 && executionResults.length === 0) || executionResults.length === 0;
    
    // If we have both results and errors, we can still potentially use the partial results
    if (executionResults.length > 0 && executionErrors.length > 0) {
      fallbackToRag = executionErrors.some(error => error.error && error.error.toString().includes("syntax error"));
    }

    let response = "I couldn't find a direct answer to your question using the available data. I will try a different approach.";
    let hasNumericResult = false;

    if (executionResults.length > 0 && !fallbackToRag) {
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

    return new Response(
      JSON.stringify({
        response,
        hasNumericResult,
        fallbackToRag,
        retryAttempted: needsRetry,
        diagnostics: includeDiagnostics ? {
          queryAnalysis: queryAnalysisPlan,
          executionResults,
          executionErrors,
          generationTime: Date.now() - startTime,
          needsRetry,
          retryAttempts
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
            - Fix time range filters (ensure proper timestamp format)`
          },
          {
            role: 'user',
            content: `The following SQL query failed with this error: "${errorMessage}"
            
            Original query: ${originalQuery}
            
            User was asking: "${userQuestion}"
            
            Provide only the corrected SQL query with no explanations or extra text.`
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
  const finalQuery = query.replace(/\$1/g, `'${userId}'`);
  
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
