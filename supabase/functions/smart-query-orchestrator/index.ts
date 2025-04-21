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
    ["hi", "hello", "hey", "who are you", "who is the president of india", "stop", "exit"].includes(lower) ||
    lower.startsWith("who is") || lower.startsWith("what is your")
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
    
    // --- Step 1: Classify the query category
    const category = classifyQueryCategory(message);

    diagnosticSteps.push({
      name: "Query Category Classification",
      status: "success",
      details: `Query classified as "${category}"`,
      timestamp: new Date().toISOString()
    });

    // --- Step 2: Planner Logic and Routing ---
    // Block or respond to "general" queries immediately
    if (category === "general") {
      let resp = "I'm designed to assist you with your journal insights and mental health queries. This question doesn't relate to your journal context.";
      if (/^(hi|hello|hey)$/i.test(message.trim())) {
        resp = "Hello! How can I help you reflect on your journaling today?";
      } else if (/who is the president/i.test(message)) {
        resp = "I'm focused on helping you with your personal journaling and cannot answer general knowledge questions.";
      }
      diagnosticSteps.push({
        name: "General Query Direct Response",
        status: "success",
        details: "Responded directly without accessing journal data.",
        timestamp: new Date().toISOString()
      });
      return new Response(JSON.stringify({
        response: resp,
        diagnostics: { steps: diagnosticSteps }
      }), { headers: corsHeaders });
    }

    // For ambiguous or unsupported queries, block/clarify
    if (category === "uncategorized") {
      diagnosticSteps.push({
        name: "Uncategorized Query Handling",
        status: "error",
        details: "Unable to classify the query. Response blocked for ambiguity.",
        timestamp: new Date().toISOString()
      });
      return new Response(JSON.stringify({
        error: "I couldn't determine how to process your question. Please rephrase, focusing on your journal or reflection.",
        diagnostics: { steps: diagnosticSteps }
      }), { status: 400, headers: corsHeaders });
    }

    // For "journal-specific" or "general-journal-specific" (those relating to journaling advice/counseling/entries)
    // Continue with original planner logic, but keep classification basis

    // --- Step 3: Analyzer Agent (decides segmentation/embedding/RAG plan) ---

    // Analyze complexity (reuse existing analyzeQuery logic)
    const queryAnalysis = await analyzeQuery(message);
    diagnosticSteps.push({
      name: "Query Analysis",
      status: "success",
      details: `Features: ${JSON.stringify(queryAnalysis.features)}`,
      timestamp: new Date().toISOString()
    });

    let response, planDetails, executionResults;

    if (queryAnalysis.isComplex) {
      // --- Step 4: Complex query planner/segmenter ---
      diagnosticSteps.push({
        name: "Planner: Complex Query Detected",
        status: "in_progress",
        details: "Planning segmentation and execution for complex query",
        timestamp: new Date().toISOString()
      });

      // Only generate one embedding for whole query
      const queryEmbedding = await generateEmbedding(message);
      diagnosticSteps.push({
        name: "Generate Query Embedding",
        status: "success",
        details: "Generated query embedding for segmentation and RAG",
        timestamp: new Date().toISOString()
      });

      // Get relevant entries for segmentation context
      const relevantEntries = await getRelevantJournalEntries(userId, queryEmbedding, 0.5, 10);
      diagnosticSteps.push({
        name: "Fetch Relevant Entries",
        status: "success",
        details: `Found ${relevantEntries.length} entries for segmentation context`,
        timestamp: new Date().toISOString()
      });

      // Segment query (using segmentation function)
      const segmentedQueries = await segmentQuery(message, relevantEntries);
      diagnosticSteps.push({
        name: "Query Segmentation",
        status: "success",
        details: `Segmented into ${segmentedQueries.length} sub-queries`,
        timestamp: new Date().toISOString()
      });

      // --- Step 5: Distributed Execution of Tasks/Segments ---
      if (segmentedQueries.length <= 1) {
        // Edge case: just run as simple RAG
        const { data: ragData, error: ragError } = await supabase.functions.invoke('chat-with-rag', {
          body: {
            message,
            userId,
            threadId,
            queryEmbedding,
            includeDiagnostics: true
          }
        });
        if (ragError) {
          diagnosticSteps.push({
            name: "Error - chat-with-rag execution",
            status: "error",
            details: ragError.message,
            timestamp: new Date().toISOString()
          });
          return new Response(JSON.stringify({
            error: ragError.message,
            diagnostics: { steps: diagnosticSteps }
          }), { status: 500, headers: corsHeaders });
        }
        response = ragData.data;
        executionResults = [{
          segment: message,
          response: ragData.data,
          references: ragData.references
        }];
        planDetails = {
          type: "simple_query",
          analysis: queryAnalysis
        };
      } else {
        // Efficient, parallel processing of segment tasks
        diagnosticSteps.push({
          name: "Planner: Distributed Segment Processing",
          status: "in_progress",
          details: `Processing ${segmentedQueries.length} segments in parallel`,
          timestamp: new Date().toISOString()
        });

        const segmentPromises = segmentedQueries.map(async segment => {
          try {
            const segmentEmbedding = await generateEmbedding(segment); // Parallel embeddings
            const { data: segmentData, error: segmentErr } = await supabase.functions.invoke('chat-with-rag', {
              body: {
                message: segment,
                userId,
                threadId,
                queryEmbedding: segmentEmbedding,
                includeDiagnostics: true
              }
            });
            if (segmentErr) {
              return { segment, error: segmentErr.message, success: false };
            }
            return {
              segment,
              response: segmentData.data,
              references: segmentData.references,
              success: true
            };
          } catch (err) {
            return { segment, error: err.message, success: false };
          }
        });

        const segmentResults = await Promise.all(segmentPromises);
        diagnosticSteps.push({
          name: "Parallel Segment Processing",
          status: "success",
          details: `Processed ${segmentResults.length} segments: ${segmentResults.filter(r => r.success).length} successful`,
          timestamp: new Date().toISOString()
        });

        const successfulResults = segmentResults.filter(r => r.success);
        if (!successfulResults.length) {
          diagnosticSteps.push({
            name: "No Successful Segment Results",
            status: "error",
            details: "Failed to get results for segments.",
            timestamp: new Date().toISOString()
          });
          return new Response(JSON.stringify({
            error: "Failed to process any query segments.",
            diagnostics: { steps: diagnosticSteps }
          }), { status: 500, headers: corsHeaders });
        }
        // Combine logic when >1 successful segment
        if (successfulResults.length === 1) {
          response = successfulResults[0].response;
          executionResults = successfulResults;
        } else {
          // Combine result edge call
          const { data: combinedData, error: combineError } = await supabase.functions.invoke('combine-segment-responses', {
            body: {
              originalQuery: message,
              segmentResults: successfulResults,
              userId,
              threadId
            }
          });
          if (combineError) {
            diagnosticSteps.push({
              name: "Error - Combining Responses",
              status: "error",
              details: combineError.message,
              timestamp: new Date().toISOString()
            });
            return new Response(JSON.stringify({
              error: "Failed to combine segment results.",
              diagnostics: { steps: diagnosticSteps }
            }), { status: 500, headers: corsHeaders });
          }
          response = combinedData.response;
          executionResults = successfulResults;
          diagnosticSteps.push({
            name: "Final Response Combination",
            status: "success",
            details: `Combined responses from ${successfulResults.length} segments`,
            timestamp: new Date().toISOString()
          });
        }
        planDetails = {
          type: "segmented_query",
          segments: segmentedQueries,
          segmentCount: segmentedQueries.length,
          analysis: queryAnalysis
        };
      }
    } else {
      // --- Step 6: Simple journal query (direct RAG) ---
      diagnosticSteps.push({
        name: "Planner: Simple Query Chosen",
        status: "success",
        details: "Direct RAG for journal query",
        timestamp: new Date().toISOString()
      });
      // One direct embedding/call
      const queryEmbedding = await generateEmbedding(message);
      diagnosticSteps.push({
        name: "Generate Query Embedding",
        status: "success",
        details: "Generated query embedding for simple query",
        timestamp: new Date().toISOString()
      });
      const { data: ragData, error: ragError } = await supabase.functions.invoke('chat-with-rag', {
        body: {
          message,
          userId,
          threadId,
          queryEmbedding,
          includeDiagnostics: true
        }
      });
      if (ragError) {
        diagnosticSteps.push({
          name: "Error - chat-with-rag execution",
          status: "error",
          details: ragError.message,
          timestamp: new Date().toISOString()
        });
        return new Response(JSON.stringify({
          error: ragError.message,
          diagnostics: { steps: diagnosticSteps }
        }), { status: 500, headers: corsHeaders });
      }
      response = ragData.data;
      executionResults = [{
        segment: message,
        response: ragData.data,
        references: ragData.references
      }];
      planDetails = {
        type: "simple_query",
        directRag: true,
        analysis: queryAnalysis
      };
    }

    // --- Step 7: Diagnostics and wrap-up
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

// Helper function to analyze a query and determine if it's complex
async function analyzeQuery(query) {
  // Check complexity factors
  const isComplexQuery = query.length > 120 || 
                         query.includes(" and ") || 
                         query.includes(" or ") ||
                         query.includes("also") ||
                         query.split("?").length > 2 ||
                         query.includes("compare") ||
                         query.includes("relationship between") ||
                         query.includes("how has") ||
                         query.includes("tell me about") && query.length > 80;
  
  // Detect features
  const features = {
    isTemporalQuery: query.includes("yesterday") || 
                    query.includes("last week") || 
                    query.includes("last month") ||
                    query.includes("this week") ||
                    query.includes("this month") ||
                    query.includes("today"),
    isEmotionFocused: /feel|feeling|felt|emotion|mood|happy|sad|angry|anxious/i.test(query),
    isQuantitative: /how much|how many|count|percentage|average|top/i.test(query),
    isComparisonQuery: /compare|versus|vs|difference between/i.test(query),
    requiresReasoning: /why|reason|explain|understand|analysis/i.test(query)
  };
  
  return {
    isComplex: isComplexQuery,
    features
  };
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

// Helper function to segment a complex query
async function segmentQuery(query, journalEntries) {
  try {
    console.log('Starting query segmentation');
    
    // Format entries to provide context
    const entriesContext = journalEntries.map(entry => ({
      content: entry.content.substring(0, 200),
      date: entry.created_at
    }));
    
    const prompt = `You are an AI assistant that segments complex user queries into simpler questions based on provided journal entries.
      User Query: ${query}
      Relevant Journal Entries: ${JSON.stringify(entriesContext)}
      Instructions:
      1. Analyze the user query and identify its main components.
      2. Break down the complex query into simpler, more specific questions that can be answered using the journal entries.
      3. Ensure each segmented question is clear, concise, and directly related to the original query.
      4. If the query is already simple, return it as a single segment.
      5. Provide the segmented questions in a JSON array format.
      
      Example:
      [
        "What were the main topics I wrote about last week?",
        "How did I feel about work during that time?",
        "Were there any specific actions I planned to take?"
      ]`;

    console.log('Calling OpenAI to segment the query');
    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!completion.ok) {
      const error = await completion.text();
      console.error('Failed to segment the query:', error);
      return [query]; // Fall back to the original query
    }

    const completionData = await completion.json();
    if (!completionData.choices || completionData.choices.length === 0) {
      console.error('Failed to segment the query - no choices returned');
      return [query]; // Fall back to the original query
    }

    let segmentedQuery;
    try {
      // Parse the segmented queries
      segmentedQuery = JSON.parse(completionData.choices[0].message.content);
      if (!Array.isArray(segmentedQuery)) {
        throw new Error("Expected array of query segments");
      }
    } catch (parseError) {
      console.error("Failed to parse segmented queries:", parseError);
      return [query]; // Fall back to the original query
    }
    
    console.log(`Segmented query into ${segmentedQuery.length} parts`);
    return segmentedQuery;
  } catch (error) {
    console.error('Error segmenting complex query:', error);
    return [query]; // Fall back to the original query
  }
}
