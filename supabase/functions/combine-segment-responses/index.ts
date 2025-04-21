
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const apiKey = Deno.env.get('OPENAI_API_KEY');

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
    const { originalQuery, segmentResults, userId, threadId, queryPlan } = await req.json();

    if (!originalQuery || !segmentResults || !Array.isArray(segmentResults)) {
      throw new Error('Missing or invalid required parameters');
    }

    // Filter to only successful segment results
    const validResults = segmentResults.filter(result => result.success && result.response);
    
    if (validResults.length === 0) {
      return new Response(JSON.stringify({
        response: "I'm sorry, I couldn't process your query properly. Could you try rephrasing or simplifying your question?",
        error: "No valid segment results to combine"
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Prepare the segments for the combination
    const segmentsFormatted = validResults.map((result, index) => {
      return {
        subQuery: result.query,
        purpose: result.purpose || `Sub-query ${index + 1}`,
        response: result.response,
        references: result.references || []
      };
    });

    // Combine the segments using OpenAI
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
            content: `You are an expert at synthesizing information from multiple sources to create comprehensive, coherent responses.
            
            You'll receive:
            1. An original question
            2. A set of sub-queries with their responses
            
            Your task is to create a unified, comprehensive response that:
            - Fully addresses all aspects of the original question
            - Integrates information from all sub-query responses
            - Maintains a natural, conversational tone
            - Eliminates redundancies and resolves any contradictions
            - Presents information in a logical, organized manner
            - Cites specific journal entries when appropriate
            
            The user is interacting with a journaling application, so all information relates to their personal journal entries.` 
          },
          { 
            role: 'user', 
            content: `Original question: "${originalQuery}"
            
            Sub-query responses:
            ${segmentsFormatted.map(segment => 
              `Sub-query: ${segment.subQuery}
               Purpose: ${segment.purpose}
               Response: ${segment.response}`
            ).join('\n\n')}
            
            Please create a unified response that fully addresses the original question by synthesizing these sub-query responses.`
          }
        ],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`Failed to combine responses: ${errorText}`);
    }

    const responseData = await response.json();
    const combinedResponse = responseData.choices[0].message.content;

    // Aggregate all references from individual segments
    const allReferences = [];
    validResults.forEach(result => {
      if (result.references && Array.isArray(result.references)) {
        result.references.forEach(ref => {
          // Only add if not already in the array (avoid duplicates)
          if (!allReferences.some(r => r.id === ref.id)) {
            allReferences.push(ref);
          }
        });
      }
    });

    return new Response(JSON.stringify({
      response: combinedResponse,
      references: allReferences,
      segmentCount: validResults.length
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error('Error in combine-segment-responses:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An unknown error occurred' 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
