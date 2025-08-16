
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
      message, 
      queryPlan, 
      results, 
      conversationContext = [], 
      userProfile = {} 
    } = await req.json();

    console.log('[GPT Response Consolidator] Processing request');
    console.log('[GPT Response Consolidator] Query plan:', queryPlan);
    console.log('[GPT Response Consolidator] Results count:', results?.length || 0);

    // Format journal entries for analysis
    const formattedEntries = (results || []).map((entry, index) => {
      const date = new Date(entry.created_at).toLocaleDateString();
      const content = entry.content || '';
      const themes = Array.isArray(entry.themes) ? entry.themes.join(', ') : '';
      const emotions = entry.emotions ? Object.keys(entry.emotions).join(', ') : '';
      
      return `Entry ${index + 1} (${date}):
Content: "${content.substring(0, 300)}${content.length > 300 ? '...' : ''}"
Themes: ${themes}
Emotions: ${emotions}
Sentiment: ${entry.sentiment || 'N/A'}

`;
    }).join('\n');

    console.log('[GPT Response Consolidator] Formatted', results?.length || 0, 'entries');

    // Create system prompt based on query plan
    const systemPrompt = `You are Ruh by SOuLO, a wickedly smart, hilariously insightful wellness companion analyzing journal data.

QUERY ANALYSIS:
- Query Type: ${queryPlan?.queryType || 'general'}
- Strategy: ${queryPlan?.strategy || 'comprehensive'}  
- Expected Response: ${queryPlan?.expectedResponseType || 'detailed_examples'}
- Requires Examples: ${queryPlan?.requiresSpecificExamples || true}
- Analysis Approach: ${queryPlan?.analysisApproach || 'Provide specific examples from journal entries'}

CRITICAL INSTRUCTIONS:
- You MUST reference specific content from the journal entries provided
- Include actual quotes and examples from the user's writing
- Be specific about dates and themes mentioned in entries
- If asking about recent journaling, provide concrete examples of what they wrote
- Use markdown formatting with **bold** for emphasis and proper paragraph breaks
- End with thoughtful follow-up questions

USER'S JOURNAL DATA:
${formattedEntries}

User timezone: ${userProfile.timezone || 'UTC'}
Current date: ${new Date().toLocaleDateString()}

Respond with specific examples from their actual journal entries, not generic advice.`;

    // Include conversation context
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add recent conversation context
    if (conversationContext && conversationContext.length > 0) {
      conversationContext.slice(-4).forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    messages.push({ role: 'user', content: message });

    console.log('[GPT Response Consolidator] Calling OpenAI with', messages.length, 'messages');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-01-14',
        messages,
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data?.choices?.[0]?.message?.content?.trim() || '';

    console.log('[GPT Response Consolidator] Generated response length:', aiResponse.length);

    return new Response(JSON.stringify({
      response: aiResponse,
      metadata: {
        entriesAnalyzed: results?.length || 0,
        queryPlan: queryPlan,
        responseGenerated: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[GPT Response Consolidator] Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      response: "I'm having trouble analyzing your journal entries right now. Could you try rephrasing your question?"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
