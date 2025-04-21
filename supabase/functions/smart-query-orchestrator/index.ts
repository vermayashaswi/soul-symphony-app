
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, threadId } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`[Orchestrator] Processing query for user ${userId}: ${message.substring(0, 50)}...`);
    
    // STEP 1: Determine if this is a complex query that needs segmentation
    const isComplexQuery = message.length > 100 || 
                          message.includes(" and ") || 
                          message.includes("also") ||
                          message.split("?").length > 2;
    
    let response, planDetails, executionResults;
    
    if (isComplexQuery) {
      console.log("[Orchestrator] Identified as complex query, using segmentation");
      
      // STEP 2A: For complex queries, use segment-complex-query
      const { data: segmentData, error: segmentError } = await supabase.functions.invoke('segment-complex-query', {
        body: {
          query: message,
          userId,
          threadId
        }
      });
      
      if (segmentError) {
        throw new Error(`Segmentation error: ${segmentError.message}`);
      }
      
      // Parse segmented queries
      let segmentedQueries;
      try {
        segmentedQueries = JSON.parse(segmentData.data);
        if (!Array.isArray(segmentedQueries)) {
          throw new Error("Expected array of query segments");
        }
      } catch (parseError) {
        console.error("[Orchestrator] Failed to parse segmented queries:", parseError);
        segmentedQueries = [message]; // Fallback to original message
      }
      
      // STEP 3A: Process each segment
      const segmentResults = [];
      
      for (let i = 0; i < segmentedQueries.length; i++) {
        const segment = segmentedQueries[i];
        console.log(`[Orchestrator] Processing segment ${i+1}: "${segment}"`);
        
        // Call the chat-with-rag function for each segment
        const { data: segmentResponseData, error: segmentResponseError } = await supabase.functions.invoke('chat-with-rag', {
          body: {
            message: segment,
            userId,
            threadId
          }
        });
        
        if (segmentResponseError) {
          console.error(`[Orchestrator] Error processing segment ${i+1}:`, segmentResponseError);
          continue;
        }
        
        segmentResults.push({
          segment,
          response: segmentResponseData.data,
          references: segmentResponseData.references
        });
      }
      
      // STEP 4A: Combine the results from all segments
      if (segmentResults.length === 0) {
        throw new Error("Failed to process any query segments");
      }
      
      if (segmentResults.length === 1) {
        // If we only have one segment result, use it directly
        response = segmentResults[0].response;
        executionResults = segmentResults;
      } else {
        // Combine the results from all segments
        const { data: combinedData, error: combineError } = await supabase.functions.invoke('combine-segment-responses', {
          body: {
            originalQuery: message,
            segmentResults,
            userId,
            threadId
          }
        });
        
        if (combineError) {
          throw new Error(`Error combining segment responses: ${combineError.message}`);
        }
        
        response = combinedData.response;
        executionResults = segmentResults;
      }
      
      planDetails = {
        type: "segmented_query",
        segments: segmentedQueries,
        segmentCount: segmentedQueries.length
      };
    } else {
      console.log("[Orchestrator] Identified as simple query, using direct RAG");
      
      // STEP 2B: For simple queries, use chat-with-rag directly
      const { data: ragData, error: ragError } = await supabase.functions.invoke('chat-with-rag', {
        body: {
          message,
          userId,
          threadId
        }
      });
      
      if (ragError) {
        throw new Error(`RAG error: ${ragError.message}`);
      }
      
      response = ragData.data;
      executionResults = [{ 
        segment: message, 
        response: ragData.data,
        references: ragData.references
      }];
      
      planDetails = {
        type: "simple_query",
        directRag: true
      };
    }
    
    return new Response(
      JSON.stringify({
        response,
        planDetails,
        executionResults
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('[Orchestrator] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
