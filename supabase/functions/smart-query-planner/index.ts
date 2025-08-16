
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { message, userId, conversationContext = [], userProfile = {} } = await req.json();

    console.log('[Smart Query Planner] Processing message:', message);
    console.log('[Smart Query Planner] User ID:', userId);

    // Generate embedding for the user's message
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: message,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI embedding error: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    console.log('[Smart Query Planner] Generated embedding for query');

    // Execute vector search to get journal entries
    const { data: vectorResults, error: vectorError } = await supabase.rpc(
      'match_journal_entries',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: 15,
        user_id_filter: userId
      }
    );

    if (vectorError) {
      console.error('[Smart Query Planner] Vector search error:', vectorError);
      throw vectorError;
    }

    console.log(`[Smart Query Planner] Vector search found ${vectorResults?.length || 0} entries`);

    // Also get recent entries for context
    const { data: recentEntries, error: recentError } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text", created_at, master_themes, emotions, sentiment')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('[Smart Query Planner] Recent entries error:', recentError);
    }

    console.log(`[Smart Query Planner] Retrieved ${recentEntries?.length || 0} recent entries`);

    // Combine results and ensure content is properly mapped
    const allResults = [...(vectorResults || []), ...(recentEntries || [])];
    const uniqueResults = Array.from(
      new Map(allResults.map(entry => [entry.id, entry])).values()
    ).slice(0, 20);

    // Ensure content field is properly set for all entries
    const processedResults = uniqueResults.map(entry => ({
      ...entry,
      content: entry.content || entry['refined text'] || entry['transcription text'] || '',
      created_at: entry.created_at,
      themes: entry.master_themes || entry.themes || [],
      emotions: entry.emotions || {},
      sentiment: entry.sentiment
    }));

    console.log(`[Smart Query Planner] Processed ${processedResults.length} total entries`);

    // Generate analysis plan using GPT
    const systemPrompt = `You are an AI assistant that analyzes journal queries and creates execution plans.

Given a user's question about their journal, create a plan that:
1. Identifies what type of analysis is needed
2. Determines the best search strategy
3. Plans how to present findings with specific examples

Available journal data includes:
- Entry content (refined and transcription text)
- Themes and emotions
- Creation dates and sentiment scores

User question: "${message}"

Available entries: ${processedResults.length} entries found
Sample themes: ${[...new Set(processedResults.flatMap(e => e.themes || []))].slice(0, 10).join(', ')}
Date range: ${processedResults.length > 0 ? `${new Date(processedResults[processedResults.length - 1]?.created_at).toLocaleDateString()} to ${new Date(processedResults[0]?.created_at).toLocaleDateString()}` : 'No entries'}

Respond with a JSON object containing:
{
  "queryType": "content_exploration|pattern_analysis|specific_lookup|general_inquiry", 
  "strategy": "comprehensive|focused|recent|historical",
  "expectedResponseType": "detailed_examples|summary_with_quotes|pattern_analysis|direct_answer",
  "requiresSpecificExamples": true/false,
  "confidenceLevel": 0.0-1.0,
  "analysisApproach": "descriptive explanation of how to analyze the data"
}`;

    const planResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-01-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
    });

    if (!planResponse.ok) {
      throw new Error(`OpenAI plan error: ${planResponse.status}`);
    }

    const planData = await planResponse.json();
    let queryPlan;

    try {
      queryPlan = JSON.parse(planData.choices[0].message.content.trim());
    } catch (parseError) {
      console.error('[Smart Query Planner] Failed to parse plan JSON:', parseError);
      // Fallback plan
      queryPlan = {
        queryType: "content_exploration",
        strategy: "comprehensive", 
        expectedResponseType: "detailed_examples",
        requiresSpecificExamples: true,
        confidenceLevel: 0.7,
        analysisApproach: "Analyze journal entries and provide specific examples"
      };
    }

    console.log('[Smart Query Planner] Generated plan:', queryPlan);

    // Return the plan and results for the consolidator
    const response = {
      success: true,
      plan: queryPlan,
      results: processedResults,
      metadata: {
        totalEntries: processedResults.length,
        vectorMatches: vectorResults?.length || 0,
        recentEntries: recentEntries?.length || 0,
        analysisTimestamp: new Date().toISOString()
      }
    };

    console.log('[Smart Query Planner] Returning response with', processedResults.length, 'entries');

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Smart Query Planner] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      plan: {
        queryType: "general_inquiry",
        strategy: "fallback",
        expectedResponseType: "direct_answer", 
        requiresSpecificExamples: false,
        confidenceLevel: 0.3,
        analysisApproach: "Provide general response due to processing error"
      },
      results: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
