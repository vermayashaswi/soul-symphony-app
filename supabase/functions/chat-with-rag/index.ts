
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { processSubQueryWithEmotionSupport } from './utils/enhancedSubQueryProcessor.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { 
      message, 
      userId, 
      threadId, 
      conversationContext = [], 
      queryPlan = {},
      useAllEntries = false,
      hasPersonalPronouns = false,
      hasExplicitTimeReference = false,
      threadMetadata = {}
    } = await req.json();

    console.log(`[Chat-with-RAG] Processing message: "${message}"`);
    console.log(`[Chat-with-RAG] Query plan:`, queryPlan);

    // Handle direct date queries
    if (queryPlan.isDirectDateQuery) {
      console.log('[Chat-with-RAG] Handling direct date query');
      return new Response(JSON.stringify({
        response: queryPlan.dateResponse,
        analysis: {
          queryType: 'direct_date',
          timeRange: queryPlan.timeRange
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine date range for analysis
    let dateRange = null;
    if (queryPlan.timeRange && !useAllEntries) {
      dateRange = {
        startDate: queryPlan.timeRange.startDate,
        endDate: queryPlan.timeRange.endDate
      };
      console.log(`[Chat-with-RAG] Using date range: ${dateRange.startDate} to ${dateRange.endDate}`);
    } else if (useAllEntries) {
      console.log('[Chat-with-RAG] Using all entries (no date constraint)');
    }

    // Process the query with enhanced validation
    const subQueryResult = await processSubQueryWithEmotionSupport(
      message,
      supabaseClient,
      userId,
      dateRange,
      openaiApiKey,
      conversationContext,
      message // Pass original message for better context
    );

    console.log(`[Chat-with-RAG] Sub-query processing completed:`, {
      totalResults: subQueryResult.totalResults,
      hasEntriesInDateRange: subQueryResult.hasEntriesInDateRange,
      shouldStopProcessing: subQueryResult.shouldStopProcessing
    });

    // CRITICAL: Check if we should stop processing due to no entries in date range
    if (subQueryResult.shouldStopProcessing && subQueryResult.noEntriesResponse) {
      console.log('[Chat-with-RAG] Stopping processing - no entries in requested date range');
      
      return new Response(JSON.stringify({
        response: subQueryResult.noEntriesResponse,
        analysis: {
          queryType: 'temporal_no_entries',
          dateRange: dateRange,
          reasoning: subQueryResult.reasoning,
          totalResults: 0
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Continue with normal processing if we have entries or it's not a temporal query
    if (subQueryResult.totalResults === 0) {
      return new Response(JSON.stringify({
        response: "I don't have enough information in your journal entries to answer that question. Could you provide more details or try asking about something you've written about recently?",
        analysis: {
          queryType: 'insufficient_data',
          reasoning: subQueryResult.reasoning,
          totalResults: 0
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate AI response using the found context
    const systemPrompt = `You are an AI assistant that analyzes personal journal entries. Based on the user's journal context provided below, answer their question thoughtfully and personally.

JOURNAL CONTEXT:
${subQueryResult.context}

ANALYSIS METADATA:
- Total relevant entries: ${subQueryResult.totalResults}
- Emotion analysis results: ${subQueryResult.emotionResults.length}
- Vector search results: ${subQueryResult.vectorResults.length}
- Reasoning: ${subQueryResult.reasoning}

Guidelines:
- Be personal and supportive in your response
- Reference specific insights from their journal entries
- Provide actionable advice when appropriate
- If discussing emotions, be empathetic and understanding
- Keep responses concise but meaningful (2-3 paragraphs max)
- Don't mention technical details about the analysis process`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 800
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const response = aiData.choices[0].message.content;

    return new Response(JSON.stringify({
      response,
      analysis: {
        queryType: 'journal_analysis',
        totalResults: subQueryResult.totalResults,
        emotionResults: subQueryResult.emotionResults.length,
        vectorResults: subQueryResult.vectorResults.length,
        reasoning: subQueryResult.reasoning,
        dateRange: dateRange
      },
      references: subQueryResult.vectorResults.slice(0, 3)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-with-rag function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      response: "I'm sorry, I encountered an error while analyzing your journal entries. Please try again."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
