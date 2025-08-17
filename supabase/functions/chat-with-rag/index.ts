
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { message, threadId, userId, conversationContext = [] } = await req.json();
    const requestId = `rag_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    console.log(`[${requestId}] Chat-with-RAG request:`, {
      message: message.substring(0, 100),
      threadId,
      userId,
      contextLength: conversationContext.length
    });

    // Step 1: Generate query plan using smart-query-planner
    console.log(`[${requestId}] Step 1: Generating query plan...`);
    const { data: plannerResponse, error: plannerError } = await supabaseClient.functions.invoke('smart-query-planner', {
      body: {
        message,
        userId,
        execute: true,
        conversationContext,
        threadId,
        requestId
      }
    });

    if (plannerError) {
      console.error(`[${requestId}] Query planner error:`, plannerError);
      throw new Error(`Query planning failed: ${plannerError.message}`);
    }

    if (!plannerResponse?.researchResults) {
      console.error(`[${requestId}] No research results from planner:`, plannerResponse);
      throw new Error('Query planner did not return research results');
    }

    console.log(`[${requestId}] Query plan generated successfully with ${plannerResponse.researchResults.length} research results`);

    // Step 2: Consolidate response using gpt-response-consolidator
    console.log(`[${requestId}] Step 2: Consolidating response...`);
    const { data: consolidatorResponse, error: consolidatorError } = await supabaseClient.functions.invoke('gpt-response-consolidator', {
      body: {
        userQuery: message,
        queryPlan: plannerResponse.queryPlan,
        researchResults: plannerResponse.researchResults,
        executionSummary: plannerResponse.executionSummary,
        requestId
      }
    });

    if (consolidatorError) {
      console.error(`[${requestId}] Consolidator error:`, consolidatorError);
      throw new Error(`Response consolidation failed: ${consolidatorError.message}`);
    }

    console.log(`[${requestId}] Response consolidated successfully`);

    // Step 3: Store message in database with proper structured data
    const messageData = {
      thread_id: threadId,
      content: consolidatorResponse.consolidatedResponse,
      sender: 'assistant',
      role: 'assistant',
      analysis_data: consolidatorResponse.analysisData || null,
      sub_query_responses: consolidatorResponse.subQueryResponses || null,
      reference_entries: consolidatorResponse.referenceEntries || null,
      has_numeric_result: false
    };

    console.log(`[${requestId}] Step 3: Storing message in database...`);
    const { data: messageInsert, error: messageError } = await supabaseClient
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();

    if (messageError) {
      console.error(`[${requestId}] Database insert error:`, messageError);
      // Don't throw error here - still return the response even if DB insert fails
    } else {
      console.log(`[${requestId}] Message stored successfully with ID:`, messageInsert.id);
    }

    // Return the consolidated response
    return new Response(JSON.stringify({
      response: consolidatorResponse.consolidatedResponse,
      analysisData: consolidatorResponse.analysisData,
      subQueryResponses: consolidatorResponse.subQueryResponses,
      referenceEntries: consolidatorResponse.referenceEntries,
      requestId,
      success: true,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-with-rag:', error);
    
    // Return a fallback response
    return new Response(JSON.stringify({
      response: "I apologize, but I'm having trouble analyzing your journal data right now. This might be a temporary issue. Please try rephrasing your question or try again in a moment.",
      error: error.message,
      analysisData: { error: error.message },
      subQueryResponses: [],
      referenceEntries: [],
      success: false,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
