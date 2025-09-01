import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const googleApiKey = Deno.env.get('GOOGLE_API_KEY');

// JSON sanitization utilities for consolidator
function stripCodeFences(s: string): string {
  try { return s.replace(/```(?:json)?/gi, '').trim(); } catch { return s; }
}

function extractFirstJsonObjectString(s: string): string | null {
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }
  }
  return null;
}

function normalizeKeys(obj: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      out[k.toLowerCase()] = (obj as any)[k];
    }
  }
  return out;
}

function coalesceResponseFields(obj: any, raw: string): { responseText: string; statusMsg: string | null } {
  const lower = normalizeKeys(obj);
  const statusMsg = (lower['userstatusmessage'] ?? lower['statusmessage'] ?? lower['user_status_message'] ?? null) as string | null;
  const responseTextCandidate = (lower['response'] ?? lower['content'] ?? lower['message'] ?? lower['text'] ?? null);
  const responseText = typeof responseTextCandidate === 'string' ? responseTextCandidate : raw;
  return { responseText: responseText, statusMsg };
}

function sanitizeConsolidatorOutput(raw: string): { responseText: string; statusMsg: string | null; meta: Record<string, any> } {
  const meta: Record<string, any> = { hadCodeFence: /```/i.test(raw || '') };
  try {
    if (!raw) {
      console.error('[CONSOLIDATOR GEMINI] Empty response from Gemini API');
      return { responseText: 'I ran into a formatting issue preparing your insights. Let\'s try again.', statusMsg: null, meta };
    }
    let s = stripCodeFences(raw);
    meta.afterStripPrefix = s.slice(0, 60);
    let parsed: any = null;
    if (s.trim().startsWith('{')) {
      try {
        parsed = JSON.parse(s);
        meta.parsedDirect = true;
      } catch {
        const jsonStr = extractFirstJsonObjectString(s);
        if (jsonStr) {
          try {
            parsed = JSON.parse(jsonStr);
            meta.parsedExtracted = true;
          } catch {
            console.error('[CONSOLIDATOR GEMINI] Failed to parse extracted JSON:', jsonStr);
          }
        }
      }
    }
    if (parsed && typeof parsed === 'object') {
      const { responseText, statusMsg } = coalesceResponseFields(parsed, s);
      return { responseText, statusMsg, meta };
    }
    return { responseText: s, statusMsg: null, meta };
  } catch (e) {
    console.error('[CONSOLIDATOR GEMINI] Sanitization error:', e);
    return { responseText: raw, statusMsg: null, meta };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const raw = await req.json();
    const userMessage = raw.userMessage;
    const researchResults = raw.researchResults ?? raw.analysisResults ?? [];
    const conversationContext = raw.conversationContext;
    const userProfile = raw.userProfile;
    const streamingMode = raw.streamingMode ?? false;
    const messageId = raw.messageId;
    const threadId = raw.threadId;
    
    // Generate unique consolidation ID for tracking
    const consolidationId = `cons_gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[CONSOLIDATION START GEMINI] ${consolidationId}:`, { 
      userMessage: userMessage?.substring(0, 100),
      researchResultsCount: researchResults?.length || 0,
      contextCount: conversationContext?.length || 0,
      streamingMode,
      messageId,
      timestamp: new Date().toISOString()
    });

    // Enhanced data validation - check for empty research results
    if (!researchResults || researchResults.length === 0) {
      console.error(`[${consolidationId}] No research results provided to consolidator`);
      return new Response(JSON.stringify({
        success: true,
        response: "I couldn't find any relevant information in your journal entries for this query. Could you try rephrasing your question or check if you have entries related to this topic?",
        userStatusMessage: "No matching entries found",
        analysisMetadata: {
          totalSubQuestions: 0,
          strategiesUsed: [],
          dataSourcesUsed: { vectorSearch: false, sqlQueries: false, errors: true }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize variables at function scope to avoid scoping issues
    let hasJournalEntries = false;
    let journalEntries: any[] = [];

    // Data integrity validation - check for processed research results
    if (researchResults && researchResults.length > 0) {
      console.log(`[RESEARCH DATA VALIDATION GEMINI] ${consolidationId}:`, {
        totalResults: researchResults.length,
        resultTypes: researchResults.map((r: any, i: number) => ({
          index: i,
          question: r?.subQuestion?.question?.substring(0, 50) || 'unknown',
          hasExecutionSummary: !!r?.executionSummary,
          summaryType: r?.executionSummary?.resultType || 'unknown',
          summaryDataType: r?.executionSummary?.dataType || 'unknown',
          hasError: !!r?.executionResults?.error || !!r?.error
        }))
      });
      
      // Check for processed summaries vs raw data
      const hasProcessedSummaries = researchResults.some((r: any) => r?.executionSummary);
      const hasRawResults = researchResults.some((r: any) => 
        r?.executionResults?.sqlResults || r?.executionResults?.vectorResults);
      
      // PHASE 4 FIX: Check specifically for journal entries from mandatory vector search
      hasJournalEntries = researchResults.some((r: any) => 
        (r?.executionResults?.vectorResults && r.executionResults.vectorResults.length > 0) ||
        (r?.executionSummary?.resultType === 'journal_content_retrieval' && r.executionSummary?.count > 0)
      );
        
      console.log(`[DATA SUMMARY GEMINI] ${consolidationId}:`, {
        hasProcessedSummaries,
        hasRawResults,
        hasJournalEntries, // PHASE 4 FIX: Log journal entries availability
        userQuestion: userMessage,
        dataStructureType: hasProcessedSummaries ? 'processed_summaries' : 'raw_results'
      });

      // Enhanced validation for empty analysis objects
      if (!hasProcessedSummaries && !hasRawResults) {
        console.warn(`[${consolidationId}] No processed summaries or raw results found despite research execution`);
        return new Response(JSON.stringify({
          success: true,
          response: "I searched through your journal entries but couldn't find specific content that matches your question. This might be because you haven't written about this topic yet, or the topic might be phrased differently in your entries. Could you try asking about it in a different way?",
          userStatusMessage: "Search completed, no matches",
          analysisMetadata: {
            totalSubQuestions: researchResults.length,
            strategiesUsed: [],
            dataSourcesUsed: { vectorSearch: false, sqlQueries: false, errors: false }
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // PHASE 1 FIX: Extract and prominently feature journal entries
      journalEntries = researchResults.flatMap((research: any, index: number) => {
        // Extract journal entries from vector search results
        const vectorResults = research?.executionResults?.vectorResults || [];
        const processedEntries = research?.executionSummary?.sampleEntries || [];
        
        // Process vector results (actual journal content)
        const vectorEntries = vectorResults.map((entry: any) => ({
          id: entry.id,
          content: entry.content || '',
          created_at: entry.created_at,
          similarity: entry.similarity,
          emotions: entry.emotions || {},
          themes: entry.themes || entry.master_themes || [],
          source: 'vector_search',
          subQuestionIndex: index + 1
        }));
        
        // Process sample entries from execution summaries
        const sampleEntries = processedEntries.map((entry: any) => ({
          id: entry.id,
          content: entry.content || '',
          created_at: entry.created_at,
          similarity: entry.similarity || 0,
          emotions: entry.emotions || {},
          themes: entry.themes || entry.master_themes || [],
          source: 'processed_summary',
          subQuestionIndex: index + 1
        }));
        
        return [...vectorEntries, ...sampleEntries];
      }).filter(entry => entry.content && entry.content.length > 0);

      console.log(`[${consolidationId}] Extracted ${journalEntries.length} journal entries for Gemini integration`);
      
      // PHASE 4 FIX: Enhanced validation and logging for journal entries
      if (!hasJournalEntries) {
        console.warn(`[${consolidationId}] No journal entries found from mandatory vector search - responses may lack specific examples`);
      } else {
        const entryCount = journalEntries?.length || 0;
        console.log(`[${consolidationId}] Successfully extracted ${entryCount} journal entries for Gemini integration`);
        
        if (entryCount > 0) {
          const entriesWithContent = journalEntries.filter((e: any) => e.content && e.content.length > 50);
          console.log(`[${consolidationId}] Journal entries validation: ${entriesWithContent.length}/${entryCount} have substantial content`);
        }
      }
    }

    // Permissive pass-through of Researcher results (no restrictive parsing)
    const MAX_SQL_ROWS = 200;
    const MAX_VECTOR_ITEMS = 20;

    const analysisSummary = researchResults.map((research: any, index: number) => {
      // Handle both processed summaries (new format) and raw results (legacy format)
      if (research?.executionSummary) {
        // NEW FORMAT: Processed summaries from smart query planner
        console.log(`[${consolidationId}] Processing summary for sub-question ${index + 1}:`, {
          resultType: research.executionSummary.resultType,
          dataType: research.executionSummary.dataType,
          summary: research.executionSummary.summary?.substring(0, 100)
        });
        
        return {
          subQuestion: research?.subQuestion ?? null,
          executionSummary: research.executionSummary,
          processedData: {
            resultType: research.executionSummary.resultType,
            dataType: research.executionSummary.dataType,
            summary: research.executionSummary.summary,
            count: research.executionSummary.count,
            analysis: research.executionSummary.analysis,
            sampleEntries: research.executionSummary.sampleEntries || [],
            totalEntriesContext: research.executionSummary.totalEntriesContext
          },
          error: research?.error ?? null
        };
      } else {
        // LEGACY FORMAT: Raw SQL/Vector results (fallback)
        const originalSql = Array.isArray(research?.executionResults?.sqlResults)
          ? research.executionResults.sqlResults
          : null;
        const originalVector = Array.isArray(research?.executionResults?.vectorResults)
          ? research.executionResults.vectorResults
          : null;

        const sqlTrimmed = !!(originalSql && originalSql.length > MAX_SQL_ROWS);
        const vectorTrimmed = !!(originalVector && originalVector.length > MAX_VECTOR_ITEMS);

        if (sqlTrimmed || vectorTrimmed) {
          console.log('Consolidator Gemini trimming payload sizes', {
            index,
            sqlRows: originalSql?.length || 0,
            sqlTrimmedTo: sqlTrimmed ? MAX_SQL_ROWS : (originalSql?.length || 0),
            vectorItems: originalVector?.length || 0,
            vectorTrimmedTo: vectorTrimmed ? MAX_VECTOR_ITEMS : (originalVector?.length || 0),
          });
        }

        return {
          subQuestion: research?.subQuestion ?? null,
          researcherOutput: research?.researcherOutput ?? null,
          executionResults: {
            ...(research?.executionResults ?? {}),
            sqlResults: originalSql ? originalSql.slice(0, MAX_SQL_ROWS) : originalSql,
            sqlRowCount: originalSql?.length ?? 0,
            sqlRowCappedTo: sqlTrimmed ? MAX_SQL_ROWS : (originalSql?.length ?? 0),
            vectorResults: originalVector ? originalVector.slice(0, MAX_VECTOR_ITEMS) : originalVector,
            vectorItemCount: originalVector?.length ?? 0,
            vectorItemCappedTo: vectorTrimmed ? MAX_VECTOR_ITEMS : (originalVector?.length ?? 0),
          },
          error: research?.executionResults?.error ?? research?.error ?? null,
          notes: sqlTrimmed || vectorTrimmed
            ? {
                truncated: true,
                reason: 'Soft cap applied to prevent token overflow',
                caps: { MAX_SQL_ROWS, MAX_VECTOR_ITEMS },
              }
            : undefined,
        };
      }
    });

    // Enhanced timezone handling with validation
    const { safeTimezoneConversion, formatTimezoneForGPT } = await import('../_shared/enhancedTimezoneUtils.ts');
    
    const rawUserTimezone = userProfile?.timezone || 'UTC';
    const timezoneConversion = safeTimezoneConversion(rawUserTimezone, {
      functionName: 'gpt-response-consolidator-gemini',
      includeValidation: true,
      logFailures: true
    });
    
    const timezoneFormat = formatTimezoneForGPT(rawUserTimezone, {
      includeUTCOffset: true,
      functionName: 'gpt-response-consolidator-gemini'
    });
    
    console.log(`[CONSOLIDATOR GEMINI] ${consolidationId} timezone info:`, {
      rawTimezone: rawUserTimezone,
      normalizedTimezone: timezoneConversion.normalizedTimezone,
      currentTime: timezoneConversion.currentTime,
      isValid: timezoneConversion.isValid,
      validationNotes: timezoneFormat.validationNotes
    });
    
    const userTimezone = timezoneConversion.normalizedTimezone;
    
    // Get user's journal timeline data for proper time context
    let timelineContext = '';
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
      
      const { data: timelineData, error: timelineError } = await supabaseClient
        .from('Journal Entries')
        .select('created_at')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
        
      const { data: latestData, error: latestError } = await supabaseClient
        .from('Journal Entries')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (timelineData && latestData) {
        const firstEntryDate = new Date(timelineData.created_at);
        const lastEntryDate = new Date(latestData.created_at);
        const currentTime = new Date();
        
        // Format dates in user's timezone
        const firstEntryFormatted = firstEntryDate.toLocaleDateString('en-US', { 
          timeZone: userTimezone, 
          month: 'long', 
          day: 'numeric',
          year: 'numeric'
        });
        const lastEntryFormatted = lastEntryDate.toLocaleDateString('en-US', { 
          timeZone: userTimezone, 
          month: 'long', 
          day: 'numeric',
          year: 'numeric'
        });
        
        // Calculate days since last entry
        const daysSinceLastEntry = Math.floor((currentTime.getTime() - lastEntryDate.getTime()) / (1000 * 60 * 60 * 24));
        
        timelineContext = `
    **CRITICAL TIMELINE CONTEXT:**
    - User's first journal entry: ${firstEntryFormatted}
    - User's most recent journal entry: ${lastEntryFormatted} (${daysSinceLastEntry} days ago)
    - NEVER use temporal words like "tonight", "today", "this evening" unless entries exist for the current date
    - When referencing time periods, be specific about the actual dates from the data
    - The user's last activity was ${daysSinceLastEntry} days ago, not recent
        `;
      }
    } catch (error) {
      console.warn(`[${consolidationId}] Could not fetch timeline data:`, error);
      timelineContext = '- No timeline data available, avoid specific time references';
    }
    
    const contextData = {
      userProfile: {
        timezone: userTimezone,
        journalEntryCount: userProfile?.journalEntryCount || 'unknown',
        premiumUser: userProfile?.is_premium || false,
      },
      meta: {
        totalResearchItems: analysisSummary.length,
        subQuestionsGenerated: analysisSummary.map(item => item.subQuestion).filter(Boolean),
        originalUserQuery: userMessage,
      }
    };

    // Construct the Gemini prompt
    const geminiPrompt = `You are Ruh by SOuLO, a brilliantly witty, non-judgmental mental health companion who makes emotional exploration feel like **having coffee with your wisest, funniest friend**. You're emotionally intelligent with a gift for making people feel seen, heard, and understood while helping them journal their way to deeper self-awareness.

**CRITICAL USER CONTEXT:**
- User's timezone: ${userTimezone}
- Current time for user: ${timezoneConversion.currentTime}
- User question: "${userMessage}"
${timelineContext}

**RESEARCH ANALYSIS AVAILABLE:**
${analysisSummary.map((item, index) => {
  if (item.executionSummary) {
    return `Sub-Question ${index + 1}: ${item.subQuestion?.question || 'Unknown'}
Result Type: ${item.executionSummary.resultType}
Summary: ${item.executionSummary.summary}
Count: ${item.executionSummary.count}
Analysis: ${JSON.stringify(item.executionSummary.analysis)}`;
  } else {
    return `Sub-Question ${index + 1}: ${item.subQuestion?.question || 'Unknown'}
SQL Results: ${item.executionResults?.sqlResults?.length || 0} rows
Vector Results: ${item.executionResults?.vectorResults?.length || 0} entries`;
  }
}).join('\n\n')}

**JOURNAL ENTRIES FOUND:**
${journalEntries.length > 0 ? journalEntries.slice(0, 5).map((entry, index) => 
  `Entry ${index + 1}: "${entry.content.substring(0, 200)}..." (Created: ${entry.created_at})`
).join('\n') : 'No specific journal entries were retrieved for this query.'}

**YOUR PERSONALITY:**
- **Brilliantly witty** but never at someone's expense - your humor comes from keen observations about the human condition 😊
- **Warm, relatable, and refreshingly honest** - you keep it real while staying supportive ☕
- **Emotionally intelligent** with a knack for reading between the lines and *truly understanding* what people need 💫

**RESPONSE REQUIREMENTS:**
1. Synthesize the research data into meaningful insights about the user's question
2. Reference specific findings from the analysis where relevant
3. Use journal entries to provide concrete examples when available
4. Maintain your warm, witty personality while being deeply insightful
5. Format with **bold** for key insights and *italics* for emotional reflections
6. Include relevant emojis but use them thoughtfully
7. Provide actionable guidance based on the patterns you've identified

Respond in JSON format:
{
  "userStatusMessage": "5 words describing your insight (e.g., 'Analyzing your emotional patterns' or 'Revealing hidden behavior insights')",
  "response": "Your comprehensive response synthesizing the research data with your warm, insightful personality"
}`;

    console.log(`[CONSOLIDATION GEMINI] ${consolidationId}: Calling Gemini API with model gemini-2.0-flash-exp`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent', {
      method: 'POST',
      headers: {
        'x-goog-api-key': googleApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: geminiPrompt }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.7
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const geminiData = await response.json();
    const rawResponse = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log(`[${consolidationId}] Gemini raw response length: ${rawResponse.length}`);
    console.log(`[${consolidationId}] Gemini raw response preview: ${rawResponse.substring(0, 200)}`);

    const { responseText, statusMsg, meta } = sanitizeConsolidatorOutput(rawResponse);

    console.log(`[CONSOLIDATION SUCCESS GEMINI] ${consolidationId}:`, {
      responseLength: responseText.length,
      hasStatusMessage: !!statusMsg,
      responsePreview: responseText.substring(0, 200)
    });

    // Store analysis data in chat_messages if messageId is provided
    if (messageId) {
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

        const analysisData = {
          consolidationId,
          totalResults: analysisSummary.length,
          userStatusMessage: statusMsg,
          timestamp: new Date().toISOString(),
          modelUsed: 'gemini-2.0-flash-exp',
          processingSuccess: true,
          hasProcessedSummaries: analysisSummary.some((item: any) => item.executionSummary),
          processedSummaries: analysisSummary.filter((item: any) => item.executionSummary).length,
          sqlResultsCount: analysisSummary.reduce((sum: number, item: any) => 
            sum + (item.executionResults?.sqlResults?.length || 0), 0),
          vectorResultsCount: analysisSummary.reduce((sum: number, item: any) => 
            sum + (item.executionResults?.vectorResults?.length || 0), 0)
        };

        console.log(`[${consolidationId}] Storing analysis data:`, {
          analysisDataKeys: Object.keys(analysisData),
          subQueryResponsesCount: analysisSummary.length,
          referenceEntriesCount: journalEntries.length
        });

        const { error: updateError } = await supabaseClient
          .from('chat_messages')
          .update({
            content: responseText,
            analysis_data: analysisData,
            sub_query_responses: analysisSummary,
            reference_entries: journalEntries.slice(0, 10), // Limit to prevent payload bloat
            is_processing: false
          })
          .eq('id', messageId);

        if (updateError) {
          console.error(`[${consolidationId}] Failed to update chat message:`, updateError);
        } else {
          console.log(`[${consolidationId}] Successfully stored analysis data in chat_messages`);
        }
      } catch (error) {
        console.error(`[${consolidationId}] Error storing analysis data:`, error);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      response: responseText,
      userStatusMessage: statusMsg,
      analysisMetadata: {
        consolidationId,
        totalSubQuestions: analysisSummary.length,
        modelUsed: 'gemini-2.0-flash-exp',
        hasJournalEntries,
        journalEntriesCount: journalEntries.length,
        dataSourcesUsed: {
          vectorSearch: analysisSummary.some((item: any) => 
            item.executionResults?.vectorResults?.length > 0),
          sqlQueries: analysisSummary.some((item: any) => 
            item.executionResults?.sqlResults?.length > 0),
          processedSummaries: analysisSummary.some((item: any) => item.executionSummary)
        },
        timezone: userTimezone,
        processingMeta: meta
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[gpt-response-consolidator-gemini] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      fallbackResponse: "I encountered an issue while analyzing your journal data. Please try your question again.",
      userStatusMessage: "Processing error occurred"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});