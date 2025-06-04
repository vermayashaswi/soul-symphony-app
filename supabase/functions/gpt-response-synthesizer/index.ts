
import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { 
      originalQuery,
      searchResults,
      aggregations,
      queryPlan,
      conversationContext = []
    } = await req.json();

    console.log(`[GPT Response Synthesizer] Synthesizing response for: "${originalQuery}"`);

    // Build context from search results
    const contextEntries = searchResults.slice(0, 10).map((result: any, index: number) => 
      `Entry ${index + 1} (Relevance: ${(result.similarity || result.emotion_score || 0).toFixed(2)}):
      Date: ${result.created_at}
      Content: ${result.content || result.chunk_content || 'No content'}
      ${result.emotions ? `Emotions: ${Object.keys(result.emotions).join(', ')}` : ''}
      ${result.themes ? `Themes: ${result.themes.join(', ')}` : ''}`
    ).join('\n\n');

    // Build aggregation context
    let aggregationContext = '';
    if (aggregations.emotionSummary) {
      aggregationContext = `\nEmotion Summary: ${aggregations.emotionSummary.map((emotion: any) => 
        `${emotion.emotion}: ${emotion.score}`
      ).join(', ')}`;
    }

    // Build conversation context
    const conversationContextString = conversationContext.length > 0 
      ? `\nConversation Context: ${conversationContext.slice(-3).map((msg: any) => 
          `${msg.role}: ${msg.content}`
        ).join('\n')}`
      : '';

    const systemPrompt = `You are SOULo, an empathetic AI assistant that helps users understand their journal entries and personal growth patterns. You have access to the user's journal data and should provide personalized, insightful responses.

Query Type: ${queryPlan.queryType}
Strategy Used: ${queryPlan.strategy}
Total Results Found: ${searchResults.length}

JOURNAL CONTEXT:
${contextEntries}${aggregationContext}${conversationContextString}

Guidelines for your response:
1. Be personal and empathetic - this is their private journal data
2. Reference specific entries and patterns you found
3. Provide actionable insights when appropriate
4. If discussing emotions, be supportive and understanding
5. Keep responses conversational and insightful (2-4 paragraphs)
6. Don't mention technical details about the search process
7. If no relevant entries were found, be honest but offer helpful alternatives
8. Connect patterns across multiple entries when relevant
9. Encourage reflection and self-awareness
10. Use a warm, supportive tone throughout

Your goal is to help the user gain deeper self-understanding through their own words and experiences.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: originalQuery }
        ],
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const synthesizedResponse = aiData.choices[0].message.content;

    console.log('[GPT Response Synthesizer] Response synthesized successfully');

    return new Response(JSON.stringify({
      response: synthesizedResponse,
      totalResultsUsed: searchResults.length,
      queryInsights: {
        type: queryPlan.queryType,
        strategy: queryPlan.strategy,
        confidence: queryPlan.confidence
      },
      references: searchResults.slice(0, 3).map((result: any) => ({
        id: result.id || result.journal_entry_id,
        content: (result.content || result.chunk_content || '').substring(0, 150),
        date: result.created_at,
        relevance: result.similarity || result.emotion_score || 0
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in gpt-response-synthesizer:', error);
    return new Response(JSON.stringify({
      error: error.message,
      response: "I'm sorry, I encountered an error while analyzing your journal entries. Please try again."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
