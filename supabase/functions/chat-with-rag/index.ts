
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced authentication and user context validation
async function validateUserContext(req: Request): Promise<{
  supabase: any;
  userId: string;
  isValid: boolean;
  error?: string;
}> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return {
      supabase: null,
      userId: '',
      isValid: false,
      error: 'No authorization header provided'
    };
  }

  // Use ANON_KEY for proper RLS authentication
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        supabase,
        userId: '',
        isValid: false,
        error: `Authentication failed: ${userError?.message || 'No user found'}`
      };
    }

    return {
      supabase,
      userId: user.id,
      isValid: true
    };
  } catch (error) {
    return {
      supabase,
      userId: '',
      isValid: false,
      error: `Authentication error: ${error.message}`
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = `rag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    console.log(`[chat-with-rag] Starting enhanced RAG processing with classification`);

    const { message, threadId, messageId, conversationContext = [], userProfile = {}, clientHint } = await req.json();
    
    // Enhanced user context validation
    const authContext = await validateUserContext(req);
    
    if (!authContext.isValid) {
      console.error(`[chat-with-rag] Authentication failed: ${authContext.error}`);
      return new Response(JSON.stringify({
        error: 'Authentication required',
        details: authContext.error,
        response: "I need you to be logged in to access your journal entries. Please sign in and try again."
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[chat-with-rag] Processing query: "${message}" for user: ${authContext.userId} (threadId: ${threadId}, messageId: ${messageId || 'none'})`);

    // Step 1: Query Classification
    console.log(`[chat-with-rag] Step 1: Query Classification`);
    
    let classification = 'JOURNAL_SPECIFIC';
    let confidence = 0.8;

    // Check for client hint override
    if (clientHint === 'JOURNAL_SPECIFIC') {
      console.error(`[chat-with-rag] CLIENT HINT: Overriding classification to JOURNAL_SPECIFIC`);
      classification = 'JOURNAL_SPECIFIC';
    }

    console.log(`[chat-with-rag] Query classified as: ${classification} (confidence: ${confidence})`);

    // Step 2: Enhanced RAG Processing for Journal-Specific Queries
    if (classification === 'JOURNAL_SPECIFIC') {
      console.log(`[chat-with-rag] EXECUTING: JOURNAL_SPECIFIC pipeline - full RAG processing`);

      try {
        // Step 2a: Call Smart Query Planner for analysis
        console.log(`[chat-with-rag] Step 2a: Calling Smart Query Planner for analysis`);

        const plannerResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/smart-query-planner`, {
          method: 'POST',
          headers: {
            'Authorization': req.headers.get('Authorization') || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            userId: authContext.userId,
            execute: true,
            conversationContext,
            threadId,
            messageId
          }),
        });

        if (!plannerResponse.ok) {
          const errorText = await plannerResponse.text();
          console.error(`[chat-with-rag] Smart Query Planner failed with status ${plannerResponse.status}:`, errorText);
          
          // Enhanced fallback for planner failures
          throw new Error(`Query planner failed: ${plannerResponse.status} - ${errorText}`);
        }

        const plannerData = await plannerResponse.json();
        console.log(`[chat-with-rag] Smart Query Planner completed successfully`);

        // Step 2b: Call GPT Response Consolidator
        console.log(`[chat-with-rag] Step 2b: Calling GPT Response Consolidator`);

        const consolidatorResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/gpt-response-consolidator`, {
          method: 'POST',
          headers: {
            'Authorization': req.headers.get('Authorization') || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userMessage: message,
            queryPlan: plannerData.queryPlan,
            researchResults: plannerData.researchResults,
            conversationContext,
            userProfile,
            executionMetadata: plannerData.executionMetadata
          }),
        });

        if (!consolidatorResponse.ok) {
          const errorText = await consolidatorResponse.text();
          console.error(`[chat-with-rag] GPT Response Consolidator failed with status ${consolidatorResponse.status}:`, errorText);
          
          // Enhanced fallback for consolidator failures
          throw new Error(`Response consolidator failed: ${consolidatorResponse.status} - ${errorText}`);
        }

        const consolidatorData = await consolidatorResponse.json();
        console.log(`[chat-with-rag] GPT Response Consolidator completed successfully`);

        // Return successful RAG response
        return new Response(JSON.stringify({
          response: consolidatorData.response,
          metadata: {
            classification,
            confidence,
            queryPlan: plannerData.queryPlan,
            executionMetadata: plannerData.executionMetadata,
            analysis: consolidatorData.analysis,
            referenceEntries: consolidatorData.referenceEntries,
            timestamp: new Date().toISOString(),
            requestId
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (plannerError) {
        console.error(`[chat-with-rag] GPT planner failed: ${plannerError}`);
        
        // Enhanced fallback response
        return new Response(JSON.stringify({
          response: `I encountered a technical issue while searching through your journal entries. This might be temporary. 

Here's what you can try:
• Wait a moment and ask your question again
• Try rephrasing your question to be more specific
• Ask about a different topic from your journal entries

I'm designed to help you explore patterns, insights, and reflections from your personal journal, so feel free to ask about emotions, themes, relationships, or specific events you've written about!`,
          metadata: {
            classification,
            confidence: 0.5,
            fallback: true,
            error: plannerError.message,
            timestamp: new Date().toISOString(),
            requestId
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Fallback for non-journal queries (shouldn't reach here with current logic)
    console.log(`[chat-with-rag] Non-journal query detected, providing general response`);
    
    return new Response(JSON.stringify({
      response: "I'm designed to help you explore and analyze your personal journal entries. Please ask me about patterns, emotions, themes, or specific topics from your journaling!",
      metadata: {
        classification,
        confidence,
        general: true,
        timestamp: new Date().toISOString(),
        requestId
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[chat-with-rag] Error in enhanced RAG:`, error);
    
    return new Response(JSON.stringify({
      error: 'RAG processing failed',
      details: error.message,
      response: "I'm experiencing technical difficulties right now. Please try your question again in a moment. If the issue continues, try rephrasing your question or asking about a different aspect of your journal entries.",
      metadata: {
        error: true,
        timestamp: new Date().toISOString(),
        requestId
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
