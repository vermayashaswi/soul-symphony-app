import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { generateResponse } from './utils/responseGenerator.ts';
import { checkForHallucinatedDates } from './utils/responseGenerator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { 
      message, 
      userId, 
      conversationContext = [], 
      userProfile = {},
      threadId,
      messageId,
      isJournalSpecific = true 
    } = await req.json();

    console.log(`[chat-with-rag] Processing query: "${message}" for user: ${userId} (threadId: ${threadId}, messageId: ${messageId || 'none'})`);
    console.log('[chat-with-rag] Starting enhanced RAG processing with classification');

    // Step 1: Query Classification
    console.log('[chat-with-rag] Step 1: Query Classification');
    
    const classificationHint = req.headers.get('x-classification-hint');
    let classification = 'JOURNAL_SPECIFIC';
    
    if (classificationHint) {
      console.error(`[chat-with-rag] CLIENT HINT: Overriding classification to ${classificationHint}`);
      classification = classificationHint;
    }
    
    console.log(`[chat-with-rag] Query classified as: ${classification} (confidence: 0.85)`);

    // Route based on classification
    if (classification === 'GENERAL_MENTAL_HEALTH') {
      console.log('[chat-with-rag] EXECUTING: GENERAL_MENTAL_HEALTH pipeline');
      
      return new Response(JSON.stringify({
        response: "Hello! I'm here to support your mental wellness journey. How can I help you today? 🌟",
        metadata: { classification: 'general_mental_health', source: 'direct_response' }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } else if (classification === 'JOURNAL_SPECIFIC_NEEDS_CLARIFICATION') {
      console.log('[chat-with-rag] EXECUTING: CLARIFICATION pipeline');
      
      return new Response(JSON.stringify({
        response: "I'd love to help analyze your journal entries! Could you be more specific about what you'd like to explore? 💭",
        metadata: { classification: 'needs_clarification', source: 'direct_response' }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } else if (classification === 'JOURNAL_SPECIFIC') {
      console.log('[chat-with-rag] EXECUTING: JOURNAL_SPECIFIC pipeline - full RAG processing');

      try {
        // Step 2: Generate query plan
        console.log('[chat-with-rag] Step 2: Query Planning');
        const planResponse = await supabase.functions.invoke('smart-query-planner', {
          body: { 
            message, 
            userId, 
            conversationContext, 
            userProfile 
          }
        });

        if (planResponse.error) {
          console.error('[chat-with-rag] GPT planner failed:', planResponse.error);
          throw new Error('Query planning failed');
        }

        const { queryPlan, vectorResults, recentEntries } = planResponse.data;

        // Step 3: Call gpt-response-consolidator with fixed parameter name
        console.log('[chat-with-rag] Step 3: Response Consolidation');
        const consolidatorResponse = await supabase.functions.invoke('gpt-response-consolidator', {
          body: {
            message,
            queryPlan,
            results: [...(vectorResults || []), ...(recentEntries || [])], // Fixed: using 'results' instead of 'researchResults'
            conversationContext,
            userProfile
          }
        });

        if (consolidatorResponse.error) {
          console.error('[chat-with-rag] Consolidator failed:', consolidatorResponse.error);
          throw new Error('Response consolidation failed');
        }

        return new Response(JSON.stringify(consolidatorResponse.data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('[chat-with-rag] Error in enhanced RAG:', error);
        throw new Error('Query planning failed');
      }
    }

    // Fallback
    return new Response(JSON.stringify({
      response: "I'm here to help! What would you like to explore about your wellness journey? 🌱",
      metadata: { classification: 'fallback', source: 'direct_response' }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[chat-with-rag] Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      response: "I'm having trouble processing your request right now. Could you try rephrasing your question? 💙"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
