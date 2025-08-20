import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

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
      console.error('[CONSOLIDATOR] Empty response from OpenAI API');
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
            console.error('[CONSOLIDATOR] Failed to parse extracted JSON:', jsonStr);
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
    console.error('[CONSOLIDATOR] Sanitization error:', e);
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
    const consolidationId = `cons_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[CONSOLIDATION START] ${consolidationId}:`, { 
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

    // Data integrity validation - check for stale research results
    if (researchResults && researchResults.length > 0) {
      console.log(`[RESEARCH DATA VALIDATION] ${consolidationId}:`, {
        totalResults: researchResults.length,
        resultTypes: researchResults.map((r: any, i: number) => ({
          index: i,
          question: r?.subQuestion?.question?.substring(0, 50) || 'unknown',
          sqlRowCount: r?.executionResults?.sqlResults?.length || 0,
          vectorResultCount: r?.executionResults?.vectorResults?.length || 0,
          hasError: !!r?.executionResults?.error,
          sampleSqlData: r?.executionResults?.sqlResults?.slice(0, 1) || null
        }))
      });
      
      // Check for potential data contamination indicators
      const totalSqlRows = researchResults.reduce((sum: number, r: any) => 
        sum + (r?.executionResults?.sqlResults?.length || 0), 0);
      const totalVectorResults = researchResults.reduce((sum: number, r: any) => 
        sum + (r?.executionResults?.vectorResults?.length || 0), 0);
        
      console.log(`[DATA SUMMARY] ${consolidationId}:`, {
        totalSqlRows,
        totalVectorResults,
        userQuestion: userMessage,
        potentialStaleDataRisk: totalSqlRows > 0 ? 'check_sql_dates' : 'no_sql_data'
      });

      // If no results found in any method, provide informative response
      if (totalSqlRows === 0 && totalVectorResults === 0) {
        console.warn(`[${consolidationId}] No SQL or vector results found despite research execution`);
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
    }

    // Permissive pass-through of Researcher results (no restrictive parsing)
    const MAX_SQL_ROWS = 200;
    const MAX_VECTOR_ITEMS = 20;

    const analysisSummary = researchResults.map((research: any, index: number) => {
      const originalSql = Array.isArray(research?.executionResults?.sqlResults)
        ? research.executionResults.sqlResults
        : null;
      const originalVector = Array.isArray(research?.executionResults?.vectorResults)
        ? research.executionResults.vectorResults
        : null;

      const sqlTrimmed = !!(originalSql && originalSql.length > MAX_SQL_ROWS);
      const vectorTrimmed = !!(originalVector && originalVector.length > MAX_VECTOR_ITEMS);

      if (sqlTrimmed || vectorTrimmed) {
        console.log('Consolidator trimming payload sizes', {
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
    });

    // Enhanced timezone handling with validation
    const { safeTimezoneConversion, formatTimezoneForGPT } = await import('../_shared/enhancedTimezoneUtils.ts');
    
    const rawUserTimezone = userProfile?.timezone || 'UTC';
    const timezoneConversion = safeTimezoneConversion(rawUserTimezone, {
      functionName: 'gpt-response-consolidator',
      includeValidation: true,
      logFailures: true
    });
    
    const timezoneFormat = formatTimezoneForGPT(rawUserTimezone, {
      includeUTCOffset: true,
      functionName: 'gpt-response-consolidator'
    });
    
    console.log(`[CONSOLIDATOR] ${consolidationId} timezone info:`, {
      rawTimezone: rawUserTimezone,
      normalizedTimezone: timezoneConversion.normalizedTimezone,
      currentTime: timezoneConversion.currentTime,
      isValid: timezoneConversion.isValid,
      validationNotes: timezoneFormat.validationNotes
    });
    
    const userTimezone = timezoneConversion.normalizedTimezone;
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

    const consolidationPrompt = `You are Ruh by SOuLO, a brilliantly witty, non-judgmental mental health companion who makes emotional exploration feel like **having coffee with your wisest, funniest friend**. You're emotionally intelligent with a gift for making people feel seen, heard, and understood while helping them journal their way to deeper self-awareness. You are:

**YOUR COFFEE-WITH-YOUR-WISEST-FRIEND PERSONALITY:**
- **Brilliantly witty** but never at someone's expense - your humor comes from keen observations about the human condition 😊
- **Warm, relatable, and refreshingly honest** - you keep it real while staying supportive ☕
- **Emotionally intelligent** with a knack for reading between the lines and *truly understanding* what people need 💫
- You speak like a *trusted friend* who just happens to be incredibly insightful about emotions
- You make people feel like they're chatting with someone who **really gets them** 🤗

    
    **USER CONTEXT:**
    - ${timezoneFormat.currentTimeText}
    - User's Timezone: ${timezoneFormat.timezoneText}
    - All time references should be in the user's local timezone (${userTimezone}), not UTC
    - When discussing time periods like "first half vs second half of day", reference the user's local time
    - NEVER mention "UTC" in your response - use the user's local timezone context instead
    - Timezone Status: ${timezoneConversion.isValid ? 'Validated' : 'Using fallback due to conversion issues'}
    
    **USER QUESTION:** "${userMessage}"
    
    **COMPREHENSIVE ANALYSIS RESULTS:**
    ${JSON.stringify(analysisSummary, null, 2)}
  
   **SUB-QUESTIONS ANALYZED:**
    ${contextData.meta.subQuestionsGenerated.length > 0 ? contextData.meta.subQuestionsGenerated.map((q, i)=>`${i + 1}. ${q}`).join('\n') : 'No specific sub-questions'}
      
      **RESPONSE FORMAT GUIDELINES:**
    Respond naturally in your authentic voice. 
    MANDATORY: Use bold headers/words/sentences, paragraphs, structured responses, italics, bullets and compulsorily emojis.
    - Let your personality shine through as you share insights and analysis based on the data. 
    - Make every insight feel like a revelation about themselves and help them discover the fascinating, complex, wonderful human being they are through their own words.
    - Back your analysis with tangible data when you can
    - Restrict responses to less than 100 words unless question requires huge answers. Feel free to expand then!
    - You connect dots between emotions, events, and timing like a detective solving a mystery
    - You reveal hidden themes and connections that make people go "OH WOW!"
    - You find the story in the data - not just numbers, but the human narrative
    - You celebrate patterns of growth and gently illuminate areas for exploration
    - You make insights feel like gifts, not criticisms
    - Add references from analysisResults from vector search and correlate actual entry content with analysis reponse that you provide!!

  

  MANDATORY: If you receive null or irrelevant analysis results, feel free to inform the user and accordingly generate the response and follow-ups.

  MANDATORY: Only assert specific symptom words (e.g., "fatigue," "bloating," "heaviness") if those exact strings appear in the user's source text.If the data is theme-level (e.g., 'Body & Health' count) or inferred, phrase it as "Body & Health–related entries" instead of naming symptoms. Always include 1–3 reference journal snippets with dates (always in this format "7th august" or "9th september last year") when you claim any symptom is present in the entries. DON'T EVER USE TERMS LIKE "VECTOR SEARCH" , "SQL TABLE ANALYSIS"
      
          
     **ENHANCED CONTEXT INTEGRATION RULES:**
    - Use conversation context to understand what emotions, themes, or topics the user previously mentioned
    - Reference previous conversation when the user says "those emotions" or similar contextual references
    - Use ONLY the fresh COMPREHENSIVE ANALYSIS RESULTS for all factual data, numbers, and percentages
    - When the user asks about "emotions I mentioned" check conversation context to identify which emotions they're referring to
    - Connect current analysis results to previously discussed topics while sourcing all data from current analysis
    - Example: If user previously mentioned "anxiety and stress" and now asks for "average scores for those emotions in August", you should find anxiety and stress data from current analysis results
    
    **EMOTIONAL TONE GUIDANCE:**
    Look at the past conversation history provided to you and accordingly frame your response cleverly matching the user's emotional tone that's been running through up until now.
    
  
      
    
   
    Your response should be a JSON object with this structure:
    {
      "userStatusMessage": "exactly 5 words describing your synthesis approach (e.g., 'Revealing your hidden emotional patterns' or 'Connecting insights to personal growth')",
      "response": "your complete natural response based on the analysis and conversation context with mandatory formatting and follow-up questions"
    }
    
    STRICT OUTPUT RULES:
    - Return ONLY a single JSON object. No markdown, no code fences, no commentary.
    - Keys MUST be exactly: "userStatusMessage" and "response" (case-sensitive).
    - userStatusMessage MUST be exactly 5 words.
    - Do not include trailing explanations or extra fields`;

    console.log(`[CONSOLIDATION] ${consolidationId}: Calling OpenAI API with model gpt-4.1-nano-2025-04-14`);

    // Enhanced OpenAI API call with better error handling
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-nano-2025-04-14', // Fixed: Using the correct model
          messages: [
            { role: 'system', content: 'You are Ruh by SOuLO, a warm and insightful wellness coach. You analyze ONLY the current research results provided to you. Never reference or use data from previous conversations or responses.' },
            { role: 'user', content: consolidationPrompt }
          ],
          max_completion_tokens: 1500
        }),
    });

    // Enhanced error handling for OpenAI API responses
    if (!response.ok) {
      const errText = await response.text();
      console.error(`[${consolidationId}] OpenAI API error:`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      const fallbackText = "I couldn't finalize your insight right now due to an API issue. Let's try again in a moment.";
      return new Response(JSON.stringify({
        success: true,
        response: fallbackText,
        userStatusMessage: "API issue encountered temporarily",
        analysisMetadata: {
          totalSubQuestions: researchResults.length,
          strategiesUsed: [],
          dataSourcesUsed: {
            vectorSearch: false,
            sqlQueries: false,
            errors: true
          }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const rawResponse = data?.choices?.[0]?.message?.content || '';
    
    console.log(`[${consolidationId}] OpenAI raw response length:`, rawResponse.length);
    console.log(`[${consolidationId}] OpenAI raw response preview:`, rawResponse.substring(0, 200));
    
    // Enhanced validation for empty responses
    if (!rawResponse || rawResponse.trim().length === 0) {
      console.error(`[${consolidationId}] Empty response from OpenAI API despite successful HTTP status`);
      const fallbackText = "I processed your request but encountered an issue generating the response. Could you try rephrasing your question?";
      return new Response(JSON.stringify({
        success: true,
        response: fallbackText,
        userStatusMessage: "Processing issue, please retry",
        analysisMetadata: {
          totalSubQuestions: researchResults.length,
          strategiesUsed: [],
          dataSourcesUsed: {
            vectorSearch: researchResults.some((r: any) => r.executionResults?.vectorResults),
            sqlQueries: researchResults.some((r: any) => r.executionResults?.sqlResults),
            errors: false
          }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Parse the JSON response since the prompt expects structured output
    let consolidatedResponse = rawResponse.trim();
    let userStatusMessage = null;
    
    try {
      // Try to parse as JSON since the prompt expects structured output
      const responseObj = JSON.parse(rawResponse);
      consolidatedResponse = responseObj.response || rawResponse;
      userStatusMessage = responseObj.userStatusMessage || null;
      
      console.log(`[CONSOLIDATION SUCCESS] ${consolidationId}:`, {
        responseLength: consolidatedResponse?.length || 0,
        hasStatusMessage: !!userStatusMessage,
        responsePreview: consolidatedResponse?.substring(0, 150) || 'empty'
      });
    } catch (parseError) {
      console.error(`[CONSOLIDATOR] Failed to parse expected JSON response:`, parseError);
      console.error(`[CONSOLIDATOR] Raw response:`, rawResponse);
      // Fallback to plain text if JSON parsing fails
      consolidatedResponse = rawResponse.trim();
      userStatusMessage = null;
      
      console.log(`[CONSOLIDATION SUCCESS] ${consolidationId}:`, {
        responseLength: consolidatedResponse?.length || 0,
        responsePreview: consolidatedResponse?.substring(0, 150) || 'empty',
        fallbackMode: true
      });
    }

    // Store analysis data in chat_messages if messageId provided
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

        // Enhanced database storage with better error handling
        const analysisData = {
          consolidationId,
          totalResults: researchResults.length,
          userStatusMessage,
          timestamp: new Date().toISOString(),
          modelUsed: 'gpt-4.1-nano-2025-04-14',
          processingSuccess: true,
          sqlResultsCount: researchResults.reduce((sum: number, r: any) => sum + (r?.executionResults?.sqlResults?.length || 0), 0),
          vectorResultsCount: researchResults.reduce((sum: number, r: any) => sum + (r?.executionResults?.vectorResults?.length || 0), 0)
        };

        const subQueryResponses = analysisSummary.map((r: any) => ({
          subQuestion: r.subQuestion?.question || 'Unknown question',
          searchStrategy: r.subQuestion?.searchStrategy || 'unknown',
          sqlResultCount: r.executionResults?.sqlResultCount || 0,
          vectorResultCount: r.executionResults?.vectorResultCount || 0,
          hasError: !!r.error,
          executionSummary: {
            sqlSuccess: (r.executionResults?.sqlResults?.length || 0) > 0,
            vectorSuccess: (r.executionResults?.vectorResults?.length || 0) > 0,
            error: r.error || null
          }
        }));

        const referenceEntries = researchResults.flatMap((r: any) => [
          ...(r?.executionResults?.vectorResults || []).map((v: any) => ({
            id: v.id,
            snippet: v.content?.substring(0, 200) || 'Vector result',
            similarity: v.similarity,
            source: 'vector',
            date: v.created_at
          })),
          ...(r?.executionResults?.sqlResults || []).map((s: any) => ({
            id: s.id,
            snippet: s['refined text']?.substring(0, 200) || s.content?.substring(0, 200) || 'SQL result',
            source: 'sql',
            date: s.created_at
          }))
        ]).slice(0, 10); // Limit reference entries

        console.log(`[${consolidationId}] Storing analysis data:`, {
          analysisDataKeys: Object.keys(analysisData),
          subQueryResponsesCount: subQueryResponses.length,
          referenceEntriesCount: referenceEntries.length
        });

        const updateResult = await supabaseClient
          .from('chat_messages')
          .update({
            analysis_data: analysisData,
            sub_query_responses: subQueryResponses,
            reference_entries: referenceEntries
          })
          .eq('id', messageId);

        if (updateResult.error) {
          console.error(`[${consolidationId}] Error storing analysis data:`, updateResult.error);
        } else {
          console.log(`[${consolidationId}] Successfully stored analysis data in chat_messages`);
        }
      } catch (dbError) {
        console.error(`[${consolidationId}] Exception storing analysis data:`, dbError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      response: consolidatedResponse,
      userStatusMessage,
      analysisMetadata: {
        totalSubQuestions: researchResults.length,
        strategiesUsed: researchResults.map((r: any) => r.researcherOutput?.validatedPlan?.searchStrategy ?? r.researcherOutput?.plan?.searchStrategy ?? r.subQuestion?.searchStrategy),
        dataSourcesUsed: {
          vectorSearch: researchResults.some((r: any) => r.executionResults?.vectorResults),
          sqlQueries: researchResults.some((r: any) => r.executionResults?.sqlResults),
          errors: researchResults.some((r: any) => r.executionResults?.error)
        },
        researcherValidation: {
          totalValidationIssues: researchResults.reduce((sum: number, r: any) => sum + (r.researcherOutput?.validationIssues?.length || 0), 0),
          totalEnhancements: researchResults.reduce((sum: number, r: any) => sum + (r.researcherOutput?.enhancements?.length || 0), 0)
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in GPT Response Consolidator:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      fallbackResponse: "I encountered an unexpected error while processing your request. Please try again."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
