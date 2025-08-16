
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced debugging for consolidator input validation with error recovery
function debugConsolidatorInput(requestData: any): {
  hasValidStructure: boolean;
  researchResultsCount: number;
  vectorResultsCount: number;
  sqlResultsCount: number;
  errorCount: number;
  debugSummary: any;
} {
  console.log('\n🔍 [CONSOLIDATOR DEBUG] Input Analysis Starting...');
  
  const researchResults = requestData.researchResults || [];
  console.log(`📊 [INPUT VALIDATION] Research results array length: ${researchResults.length}`);
  
  let totalVectorResults = 0;
  let totalSqlResults = 0;
  let totalErrors = 0;
  const debugDetails = [];
  
  researchResults.forEach((result: any, index: number) => {
    const executionResults = result?.executionResults || {};
    const vectorResults = executionResults.vectorResults || [];
    const sqlResults = executionResults.sqlResults || [];
    const errors = executionResults.errors || [];
    const vectorDebugInfo = executionResults.vectorDebugInfo;
    
    totalVectorResults += vectorResults.length;
    totalSqlResults += sqlResults.length;
    totalErrors += errors.length;
    
    const resultDebug = {
      index,
      question: result?.subQuestion?.question?.substring(0, 50) || 'unknown',
      vectorCount: vectorResults.length,
      sqlCount: sqlResults.length,
      errorCount: errors.length,
      hasVectorDebug: !!vectorDebugInfo,
      vectorDebugSummary: vectorDebugInfo ? {
        standardSearchSuccess: vectorDebugInfo.standardSearch?.success,
        standardSearchResults: vectorDebugInfo.standardSearch?.resultCount,
        timeFilteredSearchSuccess: vectorDebugInfo.timeFilteredSearch?.success,
        timeFilteredSearchResults: vectorDebugInfo.timeFilteredSearch?.resultCount,
        fallbackAttempts: vectorDebugInfo.fallbackAttempts?.length || 0,
        errors: vectorDebugInfo.errors?.length || 0
      } : null,
      errors: errors
    };
    
    debugDetails.push(resultDebug);
    
    console.log(`🎯 [RESULT ${index}] Question: "${resultDebug.question}"`, {
      vectorResults: vectorResults.length,
      sqlResults: sqlResults.length,
      errors: errors.length,
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

    // Log errors for debugging
    if (errors.length > 0) {
      console.log(`❌ [ERROR SAMPLE ${index}]:`, errors);
    }
  });
  
  const summary = {
    hasValidStructure: researchResults.length > 0,
    researchResultsCount: researchResults.length,
    vectorResultsCount: totalVectorResults,
    sqlResultsCount: totalSqlResults,
    errorCount: totalErrors,
    debugSummary: {
      overallHealth: {
        hasData: totalVectorResults > 0 || totalSqlResults > 0,
        vectorDataAvailable: totalVectorResults > 0,
        sqlDataAvailable: totalSqlResults > 0,
        hasErrors: totalErrors > 0
      },
      resultDetails: debugDetails
    }
  };
  
  console.log(`📋 [CONSOLIDATOR SUMMARY]:`, {
    totalResearchResults: summary.researchResultsCount,
    totalVectorResults: summary.vectorResultsCount,
    totalSqlResults: summary.sqlResultsCount,
    totalErrors: summary.errorCount,
    hasAnyData: summary.debugSummary.overallHealth.hasData
  });
  
  console.log('✅ [CONSOLIDATOR DEBUG] Input Analysis Complete\n');
  return summary;
}

// Enhanced fallback response generator
function generateFallbackResponse(userMessage: string, inputDebug: any): string {
  const hasErrors = inputDebug.errorCount > 0;
  const hasNoData = inputDebug.vectorResultsCount === 0 && inputDebug.sqlResultsCount === 0;
  
  if (hasErrors) {
    return `I encountered some technical issues while searching through your journal entries for "${userMessage}". This might be due to:

• Temporary system connectivity issues
• Authentication or access problems
• Data processing limitations

Please try your question again in a moment. If the issue persists, you might want to try rephrasing your question or being more specific about what you're looking for.

In the meantime, feel free to ask about general journaling topics or try a different type of question!`;
  }
  
  if (hasNoData) {
    return `I searched through your journal entries but didn't find any matching content for "${userMessage}". This could mean:

• You haven't written about this topic yet in your journal
• The content might be phrased differently in your entries
• Your question might be about something you haven't journaled about recently

Would you like to try rephrasing your question, ask about a different topic, or get some suggestions for what I can help you explore based on your journal entries?`;
  }
  
  return `I'm processing your request about "${userMessage}" but encountered some issues with the analysis. Please try again or rephrase your question for better results.`;
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
        response: "I apologize, but I encountered an issue processing your request. The analysis results were not structured correctly. Please try your question again."
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
      hasTimeRange: !!timeRange,
      errorCount: inputDebug.errorCount
    });

    // Check if we have any actual data to work with or only errors
    if (inputDebug.vectorResultsCount === 0 && inputDebug.sqlResultsCount === 0) {
      console.warn(`⚠️ [CONSOLIDATOR WARNING] ${requestId}: No vector or SQL results found, generating fallback response`);
      
      const fallbackResponse = generateFallbackResponse(userMessage, inputDebug);
      
      return new Response(JSON.stringify({
        response: fallbackResponse,
        analysis: {
          searchResults: inputDebug.errorCount > 0 ? 'errors_encountered' : 'no_data_found',
          vectorResults: inputDebug.vectorResultsCount,
          sqlResults: inputDebug.sqlResultsCount,
          errorCount: inputDebug.errorCount,
          debugInfo: inputDebug.debugSummary,
          fallbackUsed: true
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build comprehensive context for GPT with error handling
    let contextSections = [];
    let allVectorEntries = [];
    let allSqlData = [];
    let errorSummary = [];

    // Process research results with enhanced error handling
    researchResults.forEach((result: any, index: number) => {
      const subQuestion = result?.subQuestion?.question || `Research ${index + 1}`;
      const executionResults = result?.executionResults || {};
      const vectorResults = executionResults.vectorResults || [];
      const sqlResults = executionResults.sqlResults || [];
      const errors = executionResults.errors || [];

      console.log(`🔄 [PROCESSING RESULT ${index}] ${requestId}:`, {
        question: subQuestion.substring(0, 50),
        vectorCount: vectorResults.length,
        sqlCount: sqlResults.length,
        errorCount: errors.length
      });

      // Collect errors for summary
      if (errors.length > 0) {
        errorSummary.push(...errors);
      }

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
      contextSectionsCount: contextSections.length,
      totalErrors: errorSummary.length
    });

    // Generate AI response using GPT-5 with enhanced error handling
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const contextText = contextSections.length > 0 
      ? contextSections.join('\n\n---\n\n')
      : 'Limited journal data available for analysis.';

    // Enhanced system prompt with error awareness
    const systemPrompt = `You are Ruh by SOuLO, an empathetic AI journal analyst and companion. Based on the user's journal entries and analysis results, provide helpful insights and support.

**User Profile:** ${JSON.stringify(userProfile)}
**Query Plan Type:** ${queryPlan?.queryType || 'standard'}
**Analysis Strategy:** ${queryPlan?.strategy || 'basic'}
**Time Range:** ${timeRange ? JSON.stringify(timeRange) : 'All entries'}
**Processing Notes:** ${errorSummary.length > 0 ? `Some analysis components encountered issues: ${errorSummary.slice(0, 2).join(', ')}` : 'Analysis completed successfully'}

**Journal Analysis Results:**
${contextText}

**Guidelines:**
- Be empathetic, supportive, and conversational
- Reference specific entries when relevant (mention dates or content)
- Provide insights based on patterns you observe
- If data shows statistics, explain them in relatable terms
- Keep responses engaging and under 250 words
- If limited data available, focus on what you can analyze and suggest areas for future journaling
- If technical issues occurred, acknowledge them briefly but focus on available insights
- Use a warm, understanding tone as if talking to a close friend

**Data Available:**
- Vector search results: ${inputDebug.vectorResultsCount} entries
- Statistical analysis: ${inputDebug.sqlResultsCount} data points
- Research completed: ${inputDebug.researchResultsCount} analysis steps
- Processing issues: ${errorSummary.length > 0 ? 'Some components had issues' : 'All systems working normally'}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationContext.slice(-4),
      { role: 'user', content: userMessage }
    ];

    console.log(`🤖 [GPT REQUEST] ${requestId}: Sending to GPT-5 with ${contextText.length} chars of context`);

    let aiResponse;
    try {
      aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
    } catch (fetchError) {
      console.error(`❌ [GPT FETCH ERROR] ${requestId}:`, fetchError);
      
      // Fallback response when GPT fails
      const fallbackResponse = `I found some interesting information in your journal entries about "${userMessage}", but I'm having trouble generating a detailed analysis right now. 

Based on what I could process:
- Found ${allVectorEntries.length} relevant journal entries
- Analyzed ${allSqlData.length} data points

Please try your question again, or feel free to ask about specific aspects of your journaling that you'd like to explore!`;
      
      return new Response(JSON.stringify({
        response: fallbackResponse,
        analysis: {
          searchResults: 'gpt_error_fallback',
          vectorResults: inputDebug.vectorResultsCount,
          sqlResults: inputDebug.sqlResultsCount,
          queryType: queryPlan?.queryType,
          strategy: queryPlan?.strategy,
          debugInfo: inputDebug.debugSummary,
          contextLength: contextText.length,
          errorDetails: fetchError.message
        },
        referenceEntries: allVectorEntries.slice(0, 3).map((entry: any) => ({
          id: entry.id,
          content: (entry.content || entry["refined text"] || entry["transcription text"] || '').substring(0, 200),
          created_at: entry.created_at,
          similarity: entry.similarity || 0
        }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
        errorCount: inputDebug.errorCount,
        queryType: queryPlan?.queryType,
        strategy: queryPlan?.strategy,
        debugInfo: inputDebug.debugSummary,
        contextLength: contextText.length,
        processingIssues: errorSummary.length > 0 ? errorSummary.slice(0, 3) : null
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
      response: "I apologize, but I encountered an error while analyzing your journal entries. This might be a temporary issue. Please try your query again, and if the problem persists, try rephrasing your question or asking about a different topic.",
      analysis: {
        searchResults: 'consolidation_error',
        errorType: 'system_error',
        timestamp: new Date().toISOString(),
        errorDetails: error.message
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
