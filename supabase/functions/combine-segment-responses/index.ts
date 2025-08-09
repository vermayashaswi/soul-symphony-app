
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
  const subQueryResponses: Array<{ query: string; response: string }> | undefined = body?.subQueryResponses;
  const conversationContext: any[] = Array.isArray(body?.conversationContext) ? body.conversationContext : [];

  try {
    if (!originalQuery || !subQueryResponses) {
      return new Response(
        JSON.stringify({ error: 'Original query and sub-query responses are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      console.warn('[Combine Segment Responses] OPENAI_API_KEY missing. Returning concatenated fallback.');
      let fallbackResponse = '';
      subQueryResponses.forEach((sqr, index) => {
        if (index > 0) fallbackResponse += '\n\n';
        fallbackResponse += `**Q${index + 1}: ${sqr.query}**\n${sqr.response}`;
      });
      return new Response(
        JSON.stringify({ response: fallbackResponse }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Combine Segment Responses] Combining ${subQueryResponses.length} responses for: "${originalQuery}" with ${conversationContext.length} context messages`);

    // Build context string from conversation
    let contextString = '';
    if (conversationContext.length > 0) {
      contextString = `\n\nConversation context:\n${conversationContext.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`;
    }

    // Format sub-query responses
    const responsesText = subQueryResponses.map((sqr, index) => 
      `**Sub-question ${index + 1}:** ${sqr.query}\n**Analysis:** ${sqr.response}`
    ).join('\n\n');

    const prompt = `You are an expert at synthesizing multiple analyses into a cohesive, insightful response for journal analysis.

Original question: "${originalQuery}"

Individual analyses:
${responsesText}${contextString}

Your task is to combine these individual analyses into one comprehensive, well-structured response that:

1. Directly answers the original question
2. Synthesizes insights from all sub-analyses
3. Identifies patterns and connections between different aspects
4. Provides a cohesive narrative flow
5. Considers the conversation context for continuity
6. Uses bullet points and clear structure for readability
7. Maintains a supportive, insightful tone

Guidelines:
- Don't simply concatenate the responses
- Look for themes and patterns across the analyses
- Provide actionable insights where appropriate
- Keep the response focused and well-organized
- Reference specific findings from the journal data when relevant

Generate a comprehensive response that feels like a single, thoughtful analysis rather than separate pieces.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 1200
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Combine Segment Responses] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    let combinedResponse = data?.choices?.[0]?.message?.content?.trim() ?? '';

    if (!combinedResponse) {
      console.warn('[Combine Segment Responses] Empty content from OpenAI, returning concatenated fallback');
      let fallbackResponse = '';
      subQueryResponses.forEach((sqr, index) => {
        if (index > 0) fallbackResponse += '\n\n';
        fallbackResponse += `**Q${index + 1}: ${sqr.query}**\n${sqr.response}`;
      });
      return new Response(
        JSON.stringify({ response: fallbackResponse, fallbackUsed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Combine Segment Responses] Successfully combined responses with conversation context`);

    return new Response(
      JSON.stringify({ response: combinedResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Combine Segment Responses] Error:', error);

    // Fallback to simple concatenation without re-reading body
    let fallbackResponse = '';
    (subQueryResponses || []).forEach((sqr, index) => {
      if (index > 0) fallbackResponse += '\n\n';
      fallbackResponse += `**Q${index + 1}: ${sqr.query}**\n${sqr.response}`;
    });
    return new Response(
      JSON.stringify({ response: fallbackResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
