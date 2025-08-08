
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Read request body ONCE
  const body = await req.json().catch(() => null);
  const originalQuery: string | undefined = body?.originalQuery;
  const subQuestions: string[] | undefined = body?.subQuestions;
  const conversationContext: any[] = Array.isArray(body?.conversationContext) ? body.conversationContext : [];
  const queryPlan = body?.queryPlan;

  try {
    if (!originalQuery || !subQuestions) {
      return new Response(
        JSON.stringify({ error: 'Original query and sub-questions are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      console.warn('[Segment Complex Query] OPENAI_API_KEY missing. Returning original sub-questions.');
      return new Response(
        JSON.stringify({ subQuestions, reasoning: 'No OPENAI_API_KEY configured - returning original sub-questions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: [
          { role: 'system', content: [{ type: 'input_text', text: 'Return a strict JSON object only. No code fences, no extra text.' }] },
          { role: 'user', content: [{ type: 'input_text', text: prompt }] }
        ],
        max_output_tokens: 800,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Segment Complex Query] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    let content = '';
    if (typeof data.output_text === 'string' && data.output_text.trim()) {
      content = data.output_text;
    } else if (Array.isArray(data.output)) {
      content = data.output
        .map((item: any) => (item?.content ?? [])
          .map((c: any) => c?.text ?? '')
          .join(''))
        .join('');
    } else if (Array.isArray(data.content)) {
      content = data.content.map((c: any) => c?.text ?? '').join('');
    }

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    console.log(`[Segment Complex Query] GPT Response: ${content}`);

    // Extract JSON safely from content
    const extractJsonObject = (text: string): string => {
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) return fenceMatch[1].trim();
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1).trim();
      return text.trim();
    };

    const jsonString = extractJsonObject(content);
    const result = JSON.parse(jsonString);

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

    // Fallback to original sub-questions (avoid re-reading request body)
    return new Response(
      JSON.stringify({ 
        subQuestions: subQuestions || [],
        reasoning: 'Fallback due to processing error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
