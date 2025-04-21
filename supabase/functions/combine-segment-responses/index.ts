
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

    // Combine the segments using OpenAI with your refined prompt
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
            content: `You are SOuLO, an expert AI that synthesizes insights from a user's journal to provide thoughtful, personalized responses.

You’ll be given:

1. The user's original question

2. A series of sub-queries with their results, derived from analyzing journal data

Your job is to generate a clear and helpful response that:

- Fully addresses the user's original question
- Integrates relevant insights from the sub-query results
- Balances qualitative reflections (emotions, themes) with quantitative trends (frequencies, changes, patterns)
- Highlights meaningful patterns, changes over time, or emerging themes
- Presents information in a natural, human tone that is empathetic and non-judgmental
- Is concise (under 150 words), unless the question or findings require more detail
- Uses bulleted lists or headings for readability!!
- Avoids technical or implementation details (e.g., function names or database operations)
- Refers to specific journal entries only when necessary to support an insight 
- Always try and quantify aspects as well! 
- If data is insufficient to provide a meaningful answer, acknowledge this honestly and gently. Always focus on clarity, coherence, and support in your response.
`
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
