import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get OpenAI API key from environment variable
const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set');
  Deno.exit(1);
}

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Additional: Function for classifying the query category (general, journal-specific, general-journal-specific)
function classifyQueryCategory(query) {
  const lower = query.toLowerCase().trim();

  // Direct greetings, general stop or small-talk, and off-topic open-ended queries 
  if (
    ["hi", "hello", "hey", "who are you", "stop", "exit"].includes(lower) ||
    lower.startsWith("who is") || 
    lower.startsWith("what is your") ||
    /who is the (president|prime minister|leader) of/i.test(lower) ||
    /what is the (capital|population|currency) of/i.test(lower) ||
    /when (was|is|did)/i.test(lower) && !lower.includes("journal") && !lower.includes("feel")
  ) {
    return "general";
  }
  // Journal-specific requests only user journal can answer
  if (
    /(my (emotions|entries|journals|mood|energy|sleep)|what do i do about|what are my top|continue to respond|how did i feel|based on my journal|entries about|my theme|show me my)/i.test(lower)
  ) {
    return "journal-specific";
  }
  // Other chat about journaling, self-help, etc
  if (
    /(journaling|mental health|how should i|in general|tips for journaling|improve my)/i.test(lower)
  ) {
    return "general-journal-specific";
  }
  // Default: attempt to clarify
  return "uncategorized";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // For tracking diagnostics
  const diagnosticSteps = [];
  let startTime = Date.now();
  
  try {
    const { message, userId, threadId } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`[Orchestrator] Processing query for user ${userId}: ${message.substring(0, 50)}...`);
    diagnosticSteps.push({
      name: "Query Received",
      status: "success",
      details: `Processing query of length ${message.length} for user ${userId}`,
      timestamp: new Date().toISOString()
    });
    
    // --- Step 1: Gather thread context if available ---
    let threadContext = null;
    if (threadId) {
      try {
        // Fetch recent messages from the thread for context
        const { data: recentMessages, error: threadError } = await supabase
          .from('chat_messages')
          .select('content, sender, created_at')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: false })
          .limit(5);
          
        if (!threadError && recentMessages && recentMessages.length > 0) {
          threadContext = recentMessages.reverse(); // Chronological order
          
          diagnosticSteps.push({
            name: "Thread Context Retrieval",
            status: "success",
            details: `Retrieved ${threadContext.length} messages for context`,
            timestamp: new Date().toISOString()
          });
        }
      } catch (threadFetchError) {
        console.error('[Orchestrator] Error fetching thread context:', threadFetchError);
        // Non-critical error, continue without thread context
        diagnosticSteps.push({
          name: "Thread Context Retrieval",
          status: "warning",
          details: `Failed to retrieve thread context: ${threadFetchError.message}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    // --- Step 2: Classify the query category (using thread context if available) ---
    const initialCategory = classifyQueryCategory(message);
    let category = initialCategory;
    
    // If we have thread context and the query is ambiguous, use thread context to better classify
    if (threadContext && (category === "uncategorized" || message.length < 15)) {
      const threadBasedCategory = await classifyWithThreadContext(message, threadContext);
      if (threadBasedCategory !== "uncategorized") {
        category = threadBasedCategory;
        diagnosticSteps.push({
          name: "Query Category Classification",
          status: "success",
          details: `Query reclassified using thread context from "${initialCategory}" to "${category}"`,
          timestamp: new Date().toISOString()
        });
      } else {
        diagnosticSteps.push({
          name: "Query Category Classification",
          status: "success",
          details: `Query classified as "${category}" (thread context didn't help)`,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      diagnosticSteps.push({
        name: "Query Category Classification",
        status: "success",
        details: `Query classified as "${category}"`,
        timestamp: new Date().toISOString()
      });
    }

    // --- Step 3: Planner Logic and Routing ---
    
    // Check if this is a factual question that we should directly decline
    const factualQuestionPattern = /(who|what|where|when|why|how) (is|are|was|were|did) (the )?([a-z\s]+) (of|in|at|for|during) ([a-z\s]+)/i;
    if (
      message.toLowerCase().startsWith("who is") ||
      message.toLowerCase().startsWith("what is the") ||
      /who is the (president|prime minister|leader) of/i.test(message) ||
      /what is the (capital|population|currency) of/i.test(message) ||
      (factualQuestionPattern.test(message) && !message.toLowerCase().includes("journal") && !message.toLowerCase().includes("feel"))
    ) {
      const factualResponse = "I'm your emotional well-being assistant. I'm here to support your journaling practice and mental wellness, not to provide general knowledge. Could I help you reflect on something in your journal or discuss mental well-being techniques instead?";
      
      diagnosticSteps.push({
        name: "Factual Query Direct Response",
        status: "success",
        details: "Detected a factual query, providing standard response.",
        timestamp: new Date().toISOString()
      });
      
      return new Response(JSON.stringify({
        response: factualResponse,
        diagnostics: { steps: diagnosticSteps }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Process "general" or "general-journal-specific" queries with the SOuLO prompt
    if (category === "general" || category === "general-journal-specific") {
      // Directly use OpenAI with the user's special SOuLO prompt for all queries in these categories
      const finalPrompt = `
You are SOuLO, a personal mental well-being assistant that helps users reflect on their emotions, track their mental health, and grow through voice journaling.

You have received a query attached herewith. 

If it's a casual message (e.g., "hi", "hello", "how are you?") — respond briefly and kindly with a warm, human-like tone.

If it's unrelated to mental well-being or journal entries (e.g., "Who is the President of India?", "What's the capital of France?") — gently explain that you are only here to support the user's emotional well-being through journal reflection and mental health tools. DO NOT answer factual questions about general knowledge topics, politics, countries, presidents, prime ministers, or other factual information unrelated to mental health and well-being.

If it's a general mental health–related question (e.g., "What are 5 ways to reduce anxiety?", "How can I sleep better?") — answer directly and helpfully with evidence-informed, actionable advice. Be concise, empathetic, and practical.

Response Style

Be emotionally intelligent, supportive, and non-judgmental

Keep answers short and friendly (under 120 words unless more is needed)

Don't pretend to access or analyze journal data unless the query requires it

Example Responses:

"Hi there! I'm always here when you need to talk or reflect."

"I'm designed to help you reflect on your thoughts and emotions. Feel free to ask me something about your journaling journey!"

"Great question. Here are 5 proven ways to reduce anxiety:..."

For factual questions (who is president, what is a capital city, etc), ALWAYS respond with: "I'm your emotional well-being assistant. I'm here to support your journaling practice and mental wellness, not to provide general knowledge. Could I help you reflect on something in your journal or discuss mental well-being techniques instead?"
  `;

      const completion = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: finalPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.2,
          max_tokens: 250
        }),
      });

      let resp;

      if (!completion.ok) {
        const errorText = await completion.text();
        console.error('[Orchestrator] OpenAI general SOuLO prompt error:', errorText);
        resp = "I'm here to help you reflect on your journaling and well-being. Please try again or ask another question!";
      } else {
        const completionData = await completion.json();
        resp = completionData.choices?.[0]?.message?.content?.trim() ||
          "I'm here to help you with your journaling and well-being.";
      }

      diagnosticSteps.push({
        name: "General/Journal-Generic Query Direct Response",
        status: "success",
        details: "Responded with the SOuLO-style general response.",
        timestamp: new Date().toISOString()
      });

      return new Response(JSON.stringify({
        response: resp,
        diagnostics: { steps: diagnosticSteps }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // For ambiguous or unsupported queries, block/clarify
    if (category === "uncategorized") {
      diagnosticSteps.push({
        name: "Uncategorized Query Handling",
        status: "warning",
        details: "Unable to classify the query. Response offers clarification.",
        timestamp: new Date().toISOString()
      });
      return new Response(JSON.stringify({
        response: "I couldn't determine how to process your question. Could you rephrase it, focusing on your journal entries or reflections?",
        diagnostics: { steps: diagnosticSteps }
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Step 4: Get Database Schema for Planner ---
    const dbSchema = await getDatabaseSchema();
    diagnosticSteps.push({
      name: "Database Schema Retrieval",
      status: "success",
      details: `Retrieved schema information for ${Object.keys(dbSchema).length} tables`,
      timestamp: new Date().toISOString()
    });

    // --- Step 5: Enhanced Planner Agent ---
    // Analyze query complexity and formulate a plan
    const queryAnalysis = await analyzeQueryWithSchema(message, threadContext, category, dbSchema, userId);
    diagnosticSteps.push({
      name: "Enhanced Query Analysis",
      status: "success",
      details: `Analysis complete: ${queryAnalysis.planSummary}`,
      timestamp: new Date().toISOString()
    });

    let response, planDetails, executionResults;

    // --- Step 6: Execute the plan ---
    if (queryAnalysis.requiresSegmentation) {
      // --- Complex Query Execution ---
      diagnosticSteps.push({
        name: "Planner: Complex Query Execution",
        status: "in_progress",
        details: "Executing segmented query plan",
        timestamp: new Date().toISOString()
      });

      // Generate a single embedding for the original query
      const queryEmbedding = await generateEmbedding(message);
      
      // Fetch relevant entries for context
      const relevantEntries = await getRelevantJournalEntries(userId, queryEmbedding, 0.5, 10);
      diagnosticSteps.push({
        name: "Fetch Relevant Entries",
        status: "success",
        details: `Found ${relevantEntries.length} entries for context`,
        timestamp: new Date().toISOString()
      });

      // Create sub-queries based on the plan
      const subQueries = await generateSubQueries(
        message, 
        relevantEntries, 
        queryAnalysis.queryPlan, 
        dbSchema
      );
      
      diagnosticSteps.push({
        name: "Sub-Query Generation",
        status: "success",
        details: `Generated ${subQueries.length} sub-queries from query plan`,
        timestamp: new Date().toISOString()
      });

      // Execute sub-queries in parallel
      const subQueryPromises = subQueries.map(async (subQuery, index) => {
        try {
          const subQueryEmbedding = await generateEmbedding(subQuery.query);
          const { data: subQueryData, error: subQueryErr } = await supabase.functions.invoke('chat-with-rag', {
            body: {
              message: subQuery.query,
              userId,
              threadId,
              queryEmbedding: subQueryEmbedding,
              includeDiagnostics: true,
              originalQuery: message,
              queryPurpose: subQuery.purpose
            }
          });
          
          if (subQueryErr) {
            return { 
              query: subQuery.query, 
              purpose: subQuery.purpose,
              error: subQueryErr.message, 
              success: false 
            };
          }
          
          return {
            query: subQuery.query,
            purpose: subQuery.purpose,
            response: subQueryData.data,
            references: subQueryData.references,
            success: true
          };
        } catch (err) {
          return { 
            query: subQuery.query, 
            purpose: subQuery.purpose,
            error: err.message, 
            success: false 
          };
        }
      });

      const subQueryResults = await Promise.all(subQueryPromises);
      diagnosticSteps.push({
        name: "Sub-Query Execution",
        status: "success",
        details: `Completed ${subQueryResults.filter(r => r.success).length}/${subQueries.length} sub-queries successfully`,
        timestamp: new Date().toISOString()
      });

      // Combine results if we have successful sub-queries
      const successfulResults = subQueryResults.filter(r => r.success);
      
      if (successfulResults.length === 0) {
        // Fall back to direct RAG if all sub-queries failed
        const { data: directRagData, error: directRagError } = await supabase.functions.invoke('chat-with-rag', {
          body: {
            message,
            userId,
            threadId,
            queryEmbedding,
            includeDiagnostics: true
          }
        });
        
        if (directRagError) {
          throw new Error(`Failed to get direct RAG response: ${directRagError.message}`);
        }
        
        response = directRagData.data;
        executionResults = [{
          query: message,
          response: directRagData.data,
          references: directRagData.references
        }];
        
        planDetails = {
          type: "fallback_direct_query",
          originalPlan: queryAnalysis.queryPlan,
          reason: "All sub-queries failed"
        };
      } else if (successfulResults.length === 1) {
        // Just use the single successful result
        response = successfulResults[0].response;
        executionResults = successfulResults;
        planDetails = {
          type: "single_sub_query",
          plan: queryAnalysis.queryPlan,
          executedQueries: 1
        };
      } else {
        // Combine multiple sub-query results
        const { data: combinedData, error: combineError } = await supabase.functions.invoke('combine-segment-responses', {
          body: {
            originalQuery: message,
            segmentResults: successfulResults,
            userId,
            threadId,
            queryPlan: queryAnalysis.queryPlan
          }
        });
        
        if (combineError) {
          throw new Error(`Failed to combine results: ${combineError.message}`);
        }
        
        response = combinedData.response;
        executionResults = successfulResults;
        
        planDetails = {
          type: "combined_sub_queries",
          plan: queryAnalysis.queryPlan,
          executedQueries: successfulResults.length
        };
      }
    } else {
      // --- Simple Query Execution ---
      diagnosticSteps.push({
        name: "Planner: Simple Query Execution",
        status: "in_progress",
        details: "Executing direct query",
        timestamp: new Date().toISOString()
      });
      
      // Direct RAG for simple queries
      const queryEmbedding = await generateEmbedding(message);
      
      const { data: ragData, error: ragError } = await supabase.functions.invoke('chat-with-rag', {
        body: {
          message,
          userId,
          threadId,
          queryEmbedding,
          includeDiagnostics: true,
          analysisHint: queryAnalysis.processingHint || null
        }
      });
      
      if (ragError) {
        throw new Error(`Failed to get RAG response: ${ragError.message}`);
      }
      
      response = ragData.data;
      executionResults = [{
        query: message,
        response: ragData.data,
        references: ragData.references
      }];
      
      planDetails = {
        type: "direct_query",
        category: category,
        analysis: queryAnalysis
      };
    }

    // --- Step 7: Final response and diagnostics ---
    const totalTime = Date.now() - startTime;
    diagnosticSteps.push({
      name: "Query Processing Complete",
      status: "success",
      details: `Total processing time: ${totalTime}ms`,
      timestamp: new Date().toISOString()
    });
    
    return new Response(JSON.stringify({
      response,
      planDetails,
      executionResults,
      diagnostics: {
        steps: diagnosticSteps,
        totalTime
      }
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (error) {
    console.error('[Orchestrator] Error:', error);
    
    // Add error diagnostic step
    diagnosticSteps.push({
      name: "Error",
      status: "error",
      details: error.message || "Unknown error occurred",
      timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        diagnostics: {
          steps: diagnosticSteps,
          totalTime: Date.now() - startTime
        }
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// Helper function to analyze a query with database schema
async function analyzeQueryWithSchema(query, threadContext, category, dbSchema, userId) {
  try {
    console.log("[Orchestrator] Analyzing query with schema knowledge");
    
    // Get the count of journal entries to inform the planner
    const entryCount = await countJournalEntries(userId);
    
    // Prepare the prompt for the planning agent
    const promptContent = {
      query,
      threadContext: threadContext || [],
      category,
      dbSchema,
      entryCount
    };
    
    // Call OpenAI to analyze the query with schema knowledge
    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are an expert planner agent for a journaling application that determines the best way to answer user queries.
            
            You will analyze user queries and determine:
            1. If the query requires segmentation into sub-queries
            2. The type of information needed from the database
            3. The most efficient way to retrieve and process that information
            4. Whether special processing is needed (emotion analysis, temporal queries, etc.)
            
            Return your analysis in JSON format with these fields:
            - requiresSegmentation: boolean (true if query should be split)
            - queryPlan: object describing how to execute the query
            - processingHint: string (optional hints for RAG processing)
            - planSummary: string (brief summary of the plan)
            
            For complex queries, the queryPlan should include:
            - mainGoal: string
            - approach: string
            - subQueries: array of strings (if segmentation required)
            - subQueryPurposes: array of strings (what each sub-query addresses)
            - dataRequirements: object (what data fields are needed)
            - specialProcessing: array of strings (any special processing needed)` 
          },
          { 
            role: 'user', 
            content: JSON.stringify(promptContent)
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      }),
    });

    if (!completion.ok) {
      const errorText = await completion.text();
      console.error('[Orchestrator] OpenAI analysis error:', errorText);
      
      // Return a simple default analysis on error
      return {
        requiresSegmentation: false,
        processingHint: "Use general RAG approach due to analysis failure",
        planSummary: "Direct query processing due to analysis failure",
        queryPlan: null
      };
    }

    const completionData = await completion.json();
    const analysisResult = JSON.parse(completionData.choices[0].message.content);
    
    console.log("[Orchestrator] Analysis result:", JSON.stringify(analysisResult).substring(0, 200) + "...");
    
    return analysisResult;
  } catch (error) {
    console.error("[Orchestrator] Error in analyzeQueryWithSchema:", error);
    
    // Return a default analysis on error
    return {
      requiresSegmentation: false,
      processingHint: "Use general RAG approach due to analysis error",
      planSummary: "Direct query processing due to analysis error",
      queryPlan: null
    };
  }
}

// Helper function to generate sub-queries
async function generateSubQueries(originalQuery, relevantEntries, queryPlan, dbSchema) {
  try {
    console.log("[Orchestrator] Generating sub-queries from query plan");
    
    if (!queryPlan || !queryPlan.subQueries || !Array.isArray(queryPlan.subQueries)) {
      // If the plan doesn't include sub-queries, generate them
      const completion = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: `You are an expert query planner that decomposes complex questions into simpler, focused sub-queries.
              
              Original query: "${originalQuery}"
              
              Database tables: ${JSON.stringify(Object.keys(dbSchema))}
              
              Based on the relevant journal entries and database schema:
              1. Break down the original query into 2-4 focused sub-queries
              2. Each sub-query should address a specific aspect of the original question
              3. Return the sub-queries as a JSON array of objects with:
                 - query: the sub-query text
                 - purpose: what aspect this sub-query addresses`
            },
            { 
              role: 'user', 
              content: `Here are some relevant journal entries to provide context:
              ${JSON.stringify(relevantEntries.slice(0, 3).map(e => ({ 
                content: e.content.substring(0, 150) + "...", 
                date: e.created_at 
              })))}
              
              Generate sub-queries for: "${originalQuery}"`
            }
          ],
          temperature: 0.5,
          response_format: { type: "json_object" }
        }),
      });
  
      if (!completion.ok) {
        const errorText = await completion.text();
        console.error('[Orchestrator] OpenAI sub-query generation error:', errorText);
        
        // Return a fallback single query
        return [{ 
          query: originalQuery, 
          purpose: "Answer the original query directly" 
        }];
      }
  
      const completionData = await completion.json();
      try {
        const generatedSubQueries = JSON.parse(completionData.choices[0].message.content);
        
        if (Array.isArray(generatedSubQueries)) {
          return generatedSubQueries;
        } else if (generatedSubQueries.subQueries && Array.isArray(generatedSubQueries.subQueries)) {
          return generatedSubQueries.subQueries;
        } else {
          // A single fallback query if format is unexpected
          return [{ 
            query: originalQuery, 
            purpose: "Answer the original query directly" 
          }];
        }
      } catch (parseError) {
        console.error('[Orchestrator] Error parsing sub-queries:', parseError);
        return [{ 
          query: originalQuery, 
          purpose: "Answer the original query directly" 
        }];
      }
    } else {
      // Use the sub-queries already in the plan
      return queryPlan.subQueries.map((query, index) => ({
        query,
        purpose: queryPlan.subQueryPurposes && queryPlan.subQueryPurposes[index] 
          ? queryPlan.subQueryPurposes[index] 
          : `Sub-query ${index + 1}`
      }));
    }
  } catch (error) {
    console.error("[Orchestrator] Error generating sub-queries:", error);
    return [{ 
      query: originalQuery, 
      purpose: "Answer the original query directly" 
    }];
  }
}

// Helper function to generate an embedding for a text
async function generateEmbedding(text) {
  console.log("Generating embedding for text:", text.substring(0, 50) + "...");
  
  try {
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text,
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      console.error('Failed to generate embedding:', error);
      throw new Error('Failed to generate embedding for the query');
    }

    const embeddingData = await embeddingResponse.json();
    if (!embeddingData.data || embeddingData.data.length === 0) {
      throw new Error('No embedding generated');
    }
    
    return embeddingData.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

// Helper function to get relevant journal entries
async function getRelevantJournalEntries(userId, queryEmbedding, matchThreshold = 0.5, matchCount = 10) {
  try {
    console.log(`Searching journal entries for userId: ${userId}`);
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries_fixed',
      {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        user_id_filter: userId
      }
    );
    
    if (error) {
      console.error(`Error in vector search: ${error.message}`);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} entries with vector similarity`);
    return data || [];
  } catch (error) {
    console.error('Error searching journal entries:', error);
    throw error;
  }
}

// Helper function to classify with thread context
async function classifyWithThreadContext(query, threadContext) {
  try {
    // Convert thread context to a concise format
    const threadSummary = threadContext.map(msg => {
      return `${msg.sender}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`;
    }).join('\n');
    
    const prompt = `
      You are classifying a user query into categories for a journaling app chatbot.
      
      Categories:
      - "general": Basic greetings, small talk, or off-topic questions (e.g., "hi", "who is the president")
      - "journal-specific": Questions about the user's own journal entries or personal insights (e.g., "what are my top emotions", "how did I feel last week")
      - "general-journal-specific": Questions about journaling or mental health but not specific to the user's entries (e.g., "how should i journal", "tips for mental health")
      - "uncategorized": Queries that don't clearly fit the other categories
      
      Recent conversation context:
      ${threadSummary}
      
      Current user query: "${query}"
      
      Based on this conversation context and the current query, determine the most appropriate category.
      Reply with just the category name: "general", "journal-specific", "general-journal-specific", or "uncategorized".
    `;

    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 20,
      }),
    });

    if (!completion.ok) {
      const error = await completion.text();
      console.error('Failed to classify with thread context:', error);
      return "uncategorized"; // Fall back to uncategorized
    }

    const completionData = await completion.json();
    const category = completionData.choices[0].message.content.trim().toLowerCase();
    
    // Only return if it matches one of our expected categories
    if (["general", "journal-specific", "general-journal-specific", "uncategorized"].includes(category)) {
      return category;
    }
    
    return "uncategorized"; // Default if response doesn't match expected categories
  } catch (error) {
    console.error('Error classifying with thread context:', error);
    return "uncategorized";
  }
}

// Helper function to get database schema
async function getDatabaseSchema() {
  try {
    // Start with a hardcoded schema for critical tables
    const schema = {
      "Journal Entries": {
        columns: [
          "id", "user_id", "created_at", "refined text", "transcription text", 
          "emotions", "entities", "master_themes", "sentiment", "duration"
        ],
        columnTypes: {
          "id": "bigint",
          "user_id": "uuid",
          "created_at": "timestamp with time zone",
          "refined text": "text",
          "transcription text": "text",
          "emotions": "jsonb",
          "entities": "jsonb",
          "master_themes": "text[]",
          "sentiment": "text",
          "duration": "numeric"
        }
      },
      "journal_embeddings": {
        columns: ["id", "journal_entry_id", "content", "embedding", "created_at"],
        columnTypes: {
          "id": "bigint",
          "journal_entry_id": "bigint",
          "content": "text",
          "embedding": "vector",
          "created_at": "timestamp with time zone"
        }
      },
      "chat_messages": {
        columns: ["id", "thread_id", "content", "sender", "created_at", "analysis_data"],
        columnTypes: {
          "id": "uuid",
          "thread_id": "uuid",
          "content": "text",
          "sender": "text",
          "created_at": "timestamp with time zone",
          "analysis_data": "jsonb"
        }
      },
      "chat_threads": {
        columns: ["id", "user_id", "title", "created_at", "updated_at"],
        columnTypes: {
          "id": "uuid",
          "user_id": "uuid",
          "title": "text",
          "created_at": "timestamp with time zone",
          "updated_at": "timestamp with time zone"
        }
      }
    };
    
    // Try to get additional schema info from the database
    try {
      // Only check additional tables if needed
      const { data: tableColumns, error: tableError } = await supabase.rpc(
        'check_table_columns',
        { table_name: 'emotions' }
      );
      
      if (!tableError && tableColumns && tableColumns.length > 0) {
        // Add the emotions table to our schema
        schema["emotions"] = {
          columns: tableColumns.map(col => col.column_name),
          columnTypes: tableColumns.reduce((acc, col) => {
            acc[col.column_name] = col.data_type;
            return acc;
          }, {})
        };
      }
    } catch (schemaError) {
      console.error('Error getting additional schema:', schemaError);
      // Continue with hardcoded schema
    }
    
    return schema;
  } catch (error) {
    console.error('Error getting database schema:', error);
    
    // Return a minimal default schema
    return {
      "Journal Entries": {
        columns: ["id", "user_id", "created_at", "refined text", "emotions"],
        columnTypes: {
          "id": "bigint",
          "user_id": "uuid",
          "created_at": "timestamp with time zone",
          "refined text": "text",
          "emotions": "jsonb"
        }
      }
    };
  }
}

// Helper function to count journal entries
async function countJournalEntries(userId) {
  try {
    const { count, error } = await supabase
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error counting journal entries:', error);
    return 0; // Default to 0 on error
  }
}
