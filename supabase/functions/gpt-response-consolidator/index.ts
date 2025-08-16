
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced debugging for consolidator input validation
function debugConsolidatorInput(requestData: any): {
  hasValidStructure: boolean;
  researchResultsCount: number;
  vectorResultsCount: number;
  sqlResultsCount: number;
  debugSummary: any;
} {
  console.log('\n🔍 [CONSOLIDATOR DEBUG] Input Analysis Starting...');
  
  const researchResults = requestData.researchResults || [];
  console.log(`📊 [INPUT VALIDATION] Research results array length: ${researchResults.length}`);
  
  let totalVectorResults = 0;
  let totalSqlResults = 0;
  const debugDetails = [];
  
  researchResults.forEach((result: any, index: number) => {
    const executionResults = result?.executionResults || {};
    const vectorResults = executionResults.vectorResults || [];
    const sqlResults = executionResults.sqlResults || [];
    const vectorDebugInfo = executionResults.vectorDebugInfo;
    
    totalVectorResults += vectorResults.length;
    totalSqlResults += sqlResults.length;
    
    const resultDebug = {
      index,
      question: result?.subQuestion?.question?.substring(0, 50) || 'unknown',
      vectorCount: vectorResults.length,
      sqlCount: sqlResults.length,
      hasVectorDebug: !!vectorDebugInfo,
      vectorDebugSummary: vectorDebugInfo ? {
        standardSearchSuccess: vectorDebugInfo.standardSearch?.success,
        standardSearchResults: vectorDebugInfo.standardSearch?.resultCount,
        timeFilteredSearchSuccess: vectorDebugInfo.timeFilteredSearch?.success,
        timeFilteredSearchResults: vectorDebugInfo.timeFilteredSearch?.resultCount,
        errors: vectorDebugInfo.errors
      } : null
    };
    
    debugDetails.push(resultDebug);
    
    console.log(`🎯 [RESULT ${index}] Question: "${resultDebug.question}"`, {
      vectorResults: vectorResults.length,
      sqlResults: sqlResults.length,
      hasVectorDebug: resultDebug.hasVectorDebug,
      vectorDebugErrors: vectorDebugInfo?.errors?.length || 0
    });
    
    // Sample vector results for inspection
    if (vectorResults.length > 0) {
      console.log(`📝 [VECTOR SAMPLE ${index}]:`, {
        firstResult: {
          id: vectorResults[0]?.id,
          content: vectorResults[0]?.content?.substring(0, 100),
          similarity: vectorResults[0]?.similarity,
          created_at: vectorResults[0]?.created_at
        },
        totalResults: vectorResults.length
      });
    }
    
    // Sample SQL results for inspection
    if (sqlResults.length > 0) {
      console.log(`📈 [SQL SAMPLE ${index}]:`, {
        firstResult: sqlResults[0],
        totalResults: sqlResults.length
      });
    }
  });
  
  const summary = {
    hasValidStructure: researchResults.length > 0,
    researchResultsCount: researchResults.length,
    vectorResultsCount: totalVectorResults,
    sqlResultsCount: totalSqlResults,
    debugSummary: {
      overallHealth: {
        hasData: totalVectorResults > 0 || totalSqlResults > 0,
        vectorDataAvailable: totalVectorResults > 0,
        sqlDataAvailable: totalSqlResults > 0
      },
      resultDetails: debugDetails
    }
  };
  
  console.log(`📋 [CONSOLIDATOR SUMMARY]:`, {
    totalResearchResults: summary.researchResultsCount,
    totalVectorResults: summary.vectorResultsCount,
    totalSqlResults: summary.sqlResultsCount,
    hasAnyData: summary.debugSummary.overallHealth.hasData
  });
  
  console.log('✅ [CONSOLIDATOR DEBUG] Input Analysis Complete\n');
  return summary;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestId = `consolidator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const requestBody = await req.json();
    
    console.log(`\n🚀 [CONSOLIDATOR START] ${requestId}:`, {
      timestamp: new Date().toISOString(),
      hasResearchResults: !!requestBody.researchResults,
      researchResultsType: typeof requestBody.researchResults,
      researchResultsLength: Array.isArray(requestBody.researchResults) ? requestBody.researchResults.length : 'not array'
    });

    // Enhanced input validation and debugging
    const inputDebug = debugConsolidatorInput(requestBody);
    
    if (!inputDebug.hasValidStructure) {
      console.error(`❌ [CONSOLIDATOR ERROR] ${requestId}: Invalid input structure`);
      return new Response(JSON.stringify({
        error: 'Invalid input structure',
        inputDebug,
        fallback: "I apologize, but I encountered an issue processing your request. The analysis results were not structured correctly."
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const {
      userMessage,
      queryPlan,
      researchResults,
      conversationContext = [],
      userProfile = {},
      timeRange
    } = requestBody;

    console.log(`📝 [CONSOLIDATOR PARAMS] ${requestId}:`, {
      userMessage: userMessage?.substring(0, 100),
      queryType: queryPlan?.queryType,
      strategy: queryPlan?.strategy,
      contextLength: conversationContext?.length || 0,
      hasTimeRange: !!timeRange
    });

    // Check if we have any actual data to work with
    if (inputDebug.vectorResultsCount === 0 && inputDebug.sqlResultsCount === 0) {
      console.warn(`⚠️ [CONSOLIDATOR WARNING] ${requestId}: No vector or SQL results found`);
      
      // Return a helpful response explaining the lack of results
      const noDataResponse = `I searched through your journal entries but didn't find any matching content for "${userMessage}". This could mean:

• You haven't written about this topic yet
• The content might be phrased differently in your entries
• There might be a technical issue with the search

Would you like to try rephrasing your question or ask about something else?`;

      return new Response(JSON.stringify({
        response: noDataResponse,
        analysis: {
          searchResults: 'no_data_found',
          vectorResults: inputDebug.vectorResultsCount,
          sqlResults: inputDebug.sqlResultsCount,
          debugInfo: inputDebug.debugSummary
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build comprehensive context for GPT
    let contextSections = [];
    let allVectorEntries = [];
    let allSqlData = [];

    // Process research results
    researchResults.forEach((result: any, index: number) => {
      const subQuestion = result?.subQuestion?.question || `Research ${index + 1}`;
      const executionResults = result?.executionResults || {};
      const vectorResults = executionResults.vectorResults || [];
      const sqlResults = executionResults.sqlResults || [];

      console.log(`🔄 [PROCESSING RESULT ${index}] ${requestId}:`, {
        question: subQuestion.substring(0, 50),
        vectorCount: vectorResults.length,
        sqlCount: sqlResults.length
      });

      if (vectorResults.length > 0) {
        allVectorEntries.push(...vectorResults);
        const entriesText = vectorResults.map((entry: any, entryIndex: number) => {
          const content = entry.content || entry["refined text"] || entry["transcription text"] || 'No content';
          const date = entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'Unknown date';
          const similarity = entry.similarity ? ` (relevance: ${(entry.similarity * 100).toFixed(1)}%)` : '';
          
          return `Entry ${entryIndex + 1} (${date}${similarity}): ${content.substring(0, 300)}${content.length > 300 ? '...' : ''}`;
        }).join('\n\n');

        contextSections.push(`**${subQuestion}**\n${entriesText}`);
      }

      if (sqlResults.length > 0) {
        allSqlData.push(...sqlResults);
        const sqlSummary = sqlResults.map((row: any) => JSON.stringify(row)).join(', ');
        contextSections.push(`**Data Analysis for "${subQuestion}"**\n${sqlSummary}`);
      }
    });

    console.log(`📊 [DATA SUMMARY] ${requestId}:`, {
      totalVectorEntries: allVectorEntries.length,
      totalSqlRows: allSqlData.length,
      contextSectionsCount: contextSections.length
    });

    // Generate AI response using GPT-5
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const contextText = contextSections.length > 0 
      ? contextSections.join('\n\n---\n\n')
      : 'No relevant journal entries found for your query.';

    const systemPrompt = `You are Ruh by SOuLO, an empathetic AI journal analyst and companion. Based on the user's journal entries and analysis results, provide helpful insights and support.

**User Profile:** ${JSON.stringify(userProfile)}
**Query Plan Type:** ${queryPlan?.queryType || 'standard'}
**Analysis Strategy:** ${queryPlan?.strategy || 'basic'}
**Time Range:** ${timeRange ? JSON.stringify(timeRange) : 'All entries'}

**Journal Analysis Results:**
${contextText}

**Guidelines:**
- Be empathetic, supportive, and conversational
- Reference specific entries when relevant (mention dates or content)
- Provide insights based on patterns you observe
- If data shows statistics, explain them in relatable terms
- Keep responses engaging and under 200 words
- If no entries found, encourage continued journaling
- Use a warm, understanding tone as if talking to a close friend

**Data Available:**
- Vector search results: ${inputDebug.vectorResultsCount} entries
- Statistical analysis: ${inputDebug.sqlResultsCount} data points
- Research completed: ${inputDebug.researchResultsCount} analysis steps`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationContext.slice(-4),
      { role: 'user', content: userMessage }
    ];

    console.log(`🤖 [GPT REQUEST] ${requestId}: Sending to GPT-5 with ${contextText.length} chars of context`);

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages,
        max_completion_tokens: 600,
        // Note: temperature not supported in GPT-5
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`❌ [GPT ERROR] ${requestId}:`, errorText);
      throw new Error(`OpenAI API error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices[0].message.content;

    console.log(`✅ [CONSOLIDATOR SUCCESS] ${requestId}: Generated ${responseText.length} char response`);

    return new Response(JSON.stringify({
      response: responseText,
      analysis: {
        searchResults: 'consolidated_successfully',
        vectorResults: inputDebug.vectorResultsCount,
        sqlResults: inputDebug.sqlResultsCount,
        queryType: queryPlan?.queryType,
        strategy: queryPlan?.strategy,
        debugInfo: inputDebug.debugSummary,
        contextLength: contextText.length
      },
      referenceEntries: allVectorEntries.slice(0, 5).map((entry: any) => ({
        id: entry.id,
        content: (entry.content || entry["refined text"] || entry["transcription text"] || '').substring(0, 200),
        created_at: entry.created_at,
        similarity: entry.similarity || 0
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`❌ [CONSOLIDATOR ERROR]:`, error);
    return new Response(JSON.stringify({
      error: error.message,
      response: "I apologize, but I encountered an error while analyzing your journal entries. Please try your query again.",
      analysis: {
        searchResults: 'error',
        errorType: 'consolidation_error',
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
