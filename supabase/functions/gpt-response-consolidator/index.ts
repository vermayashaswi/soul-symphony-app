
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResearchResult {
  subQuestion: string;
  purpose: string;
  searchStrategy: string;
  executionResults: {
    sqlResults: Array<{
      step: number;
      description: string;
      results: any[];
    }>;
    vectorResults: Array<{
      step: number;
      description: string;
      results: any[];
    }>;
    hybridResults: Array<{
      step: number;
      description: string;
      results: {
        sqlData: any[];
        vectorData: any[];
      };
    }>;
  };
}

async function consolidateResponse(
  userQuery: string,
  queryPlan: any,
  researchResults: ResearchResult[],
  executionSummary: any,
  openaiApiKey: string
): Promise<{
  consolidatedResponse: string;
  analysisData: any;
  subQueryResponses: any[];
  referenceEntries: any[];
}> {

  // Extract reference entries from vector search results
  const referenceEntries = [];
  const subQueryResponses = [];
  
  for (const result of researchResults) {
    // Process vector results for reference entries
    for (const vectorResult of result.executionResults.vectorResults) {
      if (vectorResult.results && Array.isArray(vectorResult.results)) {
        referenceEntries.push(...vectorResult.results.map(entry => ({
          id: entry.id,
          content: entry.content?.substring(0, 200) || '',
          similarity: entry.similarity || 0,
          created_at: entry.created_at,
          source: 'vector_search'
        })));
      }
    }

    // Process hybrid results
    for (const hybridResult of result.executionResults.hybridResults) {
      if (hybridResult.results?.vectorData) {
        referenceEntries.push(...hybridResult.results.vectorData.map(entry => ({
          id: entry.id,
          content: entry.content?.substring(0, 200) || '',
          similarity: entry.similarity || 0,
          created_at: entry.created_at,
          source: 'hybrid_search'
        })));
      }
    }

    // Structure sub-query responses
    subQueryResponses.push({
      question: result.subQuestion,
      purpose: result.purpose,
      strategy: result.searchStrategy,
      sqlResultCount: result.executionResults.sqlResults.length,
      vectorResultCount: result.executionResults.vectorResults.length,
      hybridResultCount: result.executionResults.hybridResults.length,
      totalDataPoints: [
        ...result.executionResults.sqlResults,
        ...result.executionResults.vectorResults,
        ...result.executionResults.hybridResults
      ].reduce((sum, r) => sum + (Array.isArray(r.results) ? r.results.length : 
        (r.results?.sqlData?.length || 0) + (r.results?.vectorData?.length || 0)), 0)
    });
  }

  // Remove duplicates from reference entries
  const uniqueReferenceEntries = referenceEntries.filter((entry, index, self) => 
    index === self.findIndex(e => e.id === entry.id)
  ).slice(0, 20); // Limit to top 20 references

  // Prepare data for GPT consolidation
  const consolidationContext = researchResults.map(result => {
    return {
      question: result.subQuestion,
      purpose: result.purpose,
      findings: {
        sql_insights: result.executionResults.sqlResults.map(sql => ({
          description: sql.description,
          data_summary: Array.isArray(sql.results) ? 
            `${sql.results.length} records found` : 
            'No data available',
          key_points: sql.results?.slice(0, 3) || []
        })),
        semantic_insights: result.executionResults.vectorResults.map(vec => ({
          description: vec.description,
          entries_found: vec.results?.length || 0,
          relevance_scores: vec.results?.map(r => r.similarity).slice(0, 3) || [],
          content_preview: vec.results?.map(r => r.content?.substring(0, 100)).slice(0, 2) || []
        })),
        hybrid_insights: result.executionResults.hybridResults.map(hyb => ({
          description: hyb.description,
          sql_data_points: hyb.results?.sqlData?.length || 0,
          vector_matches: hyb.results?.vectorData?.length || 0
        }))
      }
    };
  });

  const systemPrompt = `You are SOULo's Response Consolidator - a specialized AI that transforms research findings into insightful, personalized responses for journal analysis.

**YOUR MISSION:**
Transform the research findings into a comprehensive, insightful response that directly addresses the user's query while providing meaningful personal insights based on their journal data.

**RESPONSE GUIDELINES:**
1. **Personal & Conversational**: Write as if you're a knowledgeable friend who has carefully analyzed their journal
2. **Insight-Driven**: Don't just report data - provide meaningful interpretations and patterns
3. **Actionable**: Include practical insights or suggestions when appropriate
4. **Respectful**: Handle emotional content with sensitivity and care
5. **Structured**: Use clear organization with insights, patterns, and key findings

**CONTEXT:**
- User Query: "${userQuery}"
- Analysis Strategy: ${queryPlan.strategy}
- Research Confidence: ${executionSummary.confidence}
- Sub-Questions Analyzed: ${executionSummary.totalSubQuestions}

**RESEARCH FINDINGS:**
${JSON.stringify(consolidationContext, null, 2)}

**OUTPUT REQUIREMENTS:**
Provide a thoughtful, comprehensive response that:
- Directly answers the user's question
- Highlights key patterns and insights from the data
- Provides context and interpretation of findings
- Maintains a supportive, understanding tone
- Offers practical implications or suggestions where appropriate

Focus on being genuinely helpful and insightful rather than just summarizing data.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please consolidate these research findings into a comprehensive response for the user.` }
      ],
      max_completion_tokens: 1000
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const consolidatedResponse = data.choices[0].message.content;

  // Structure analysis data for database storage
  const analysisData = {
    query_plan: {
      strategy: queryPlan.strategy,
      confidence: queryPlan.confidence,
      sub_questions_count: executionSummary.totalSubQuestions,
      total_steps: executionSummary.totalSteps
    },
    execution_summary: executionSummary,
    research_insights: consolidationContext,
    data_sources: {
      sql_queries: researchResults.reduce((sum, r) => sum + r.executionResults.sqlResults.length, 0),
      vector_searches: researchResults.reduce((sum, r) => sum + r.executionResults.vectorResults.length, 0),
      hybrid_searches: researchResults.reduce((sum, r) => sum + r.executionResults.hybridResults.length, 0)
    },
    reference_entries_count: uniqueReferenceEntries.length
  };

  return {
    consolidatedResponse,
    analysisData,
    subQueryResponses,
    referenceEntries: uniqueReferenceEntries
  };
}

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
      userQuery, 
      queryPlan, 
      researchResults, 
      executionSummary,
      requestId 
    } = await req.json();

    console.log(`[GPT Consolidator] Processing request ${requestId} for query: "${userQuery?.substring(0, 50)}..."`);

    if (!researchResults || !Array.isArray(researchResults)) {
      throw new Error('Invalid research results provided');
    }

    const result = await consolidateResponse(
      userQuery,
      queryPlan,
      researchResults,
      executionSummary,
      openaiApiKey
    );

    console.log(`[GPT Consolidator] Successfully consolidated response for ${requestId}`);

    return new Response(JSON.stringify({
      ...result,
      success: true,
      timestamp: new Date().toISOString(),
      requestId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in GPT response consolidator:', error);
    return new Response(JSON.stringify({
      error: error.message,
      consolidatedResponse: "I apologize, but I encountered an issue while analyzing your journal data. Please try rephrasing your question or contact support if the problem persists.",
      analysisData: { error: error.message },
      subQueryResponses: [],
      referenceEntries: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
