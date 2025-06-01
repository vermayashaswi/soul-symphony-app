
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originalQuery, subQuestions, conversationContext = [], queryPlan } = await req.json();

    if (!originalQuery || !subQuestions) {
      return new Response(
        JSON.stringify({ error: 'Original query and sub-questions are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`[Segment Complex Query] Processing: "${originalQuery}" with ${subQuestions.length} sub-questions and ${conversationContext.length} context messages`);

    // Build context string from conversation
    let contextString = '';
    if (conversationContext.length > 0) {
      contextString = `\n\nConversation context:\n${conversationContext.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`;
    }

    const prompt = `You are an expert at refining and optimizing questions for journal analysis.

Original complex query: "${originalQuery}"
Initial sub-questions: ${JSON.stringify(subQuestions, null, 2)}
Query plan strategy: ${queryPlan?.strategy || 'unknown'}${contextString}

Your task is to refine these sub-questions to be more specific, actionable, and better suited for journal entry analysis.

Guidelines:
1. Make questions more specific and focused
2. Ensure each question targets a different aspect of the original query
3. Remove redundancy between questions
4. Optimize for journal entry analysis (emotions, patterns, themes, timeline)
5. Consider the conversation context when refining questions
6. Maintain the intent of the original query

Return a JSON object with this structure:
{
  "subQuestions": [
    "refined question 1",
    "refined question 2",
    ...
  ],
  "reasoning": "brief explanation of refinements made"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Segment Complex Query] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    console.log(`[Segment Complex Query] GPT Response: ${content}`);

    // Parse the JSON response
    const result = JSON.parse(content);
    
    if (!result.subQuestions || !Array.isArray(result.subQuestions)) {
      throw new Error('Invalid response format from GPT');
    }

    console.log(`[Segment Complex Query] Refined ${result.subQuestions.length} sub-questions with conversation context`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Segment Complex Query] Error:', error);
    
    // Fallback to original sub-questions
    try {
      const { subQuestions } = await req.json();
      return new Response(
        JSON.stringify({ 
          subQuestions: subQuestions || [],
          reasoning: 'Fallback due to processing error'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (fallbackError) {
      return new Response(
        JSON.stringify({ error: 'Failed to process query segmentation' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  }
});
