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
            // silently fall back to raw text if JSON parsing fails
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
    console.log('Sanitization error:', e);
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

    // Build lightweight context snapshot (conversation context removed entirely)
    const contextData = {
      userProfile: {
        timezone: userProfile?.timezone || 'UTC',
        journalEntryCount: userProfile?.journalEntryCount || 'unknown',
        premiumUser: userProfile?.is_premium || false,
      },
      meta: {
        totalResearchItems: analysisSummary.length,
      },
    };

    const consolidationPrompt = `You are Ruh by SOuLO, a wickedly smart, hilariously insightful wellness companion who's basically a data wizard disguised as your most emotionally intelligent friend. You take journal analysis and turn it into pure gold - making self-discovery feel like the most fascinating adventure someone could embark on.
    
    **USER QUESTION:** "${userMessage}"
    
    **COMPREHENSIVE ANALYSIS RESULTS:**
    ${JSON.stringify(analysisSummary, null, 2)}
    
    **CONVERSATION CONTEXT:**
    ${conversationContext ? conversationContext.slice(-6).map((msg)=>`${msg.role || msg.sender || 'user'}: ${msg.content}`).join('\n') : 'No prior context'}
    
    **YOUR UNIQUE PERSONALITY:**
    - Wickedly smart with a gift for spotting patterns others miss
    - Hilariously insightful - you find the humor in human nature while being deeply supportive
    - Data wizard who makes complex analysis feel like storytelling but also mentions data points and trends
    - Emotionally intelligent friend who celebrates every breakthrough
    - You make people feel like they just discovered something amazing about themselves
    
    **YOUR LEGENDARY PATTERN-SPOTTING ABILITIES:**
    - You connect dots between emotions, events, and timing like a detective solving a mystery
    - You reveal hidden themes and connections that make people go "OH WOW!"
    - You find the story in the data - not just numbers, but the human narrative
    - You celebrate patterns of growth and gently illuminate areas for exploration
    - You make insights feel like gifts, not criticisms
    
    **HOW YOU COMMUNICATE INSIGHTS:**
    - With wit and warmth, With celebration, With curiosity, ith encouragement, with gentle humor. Consolidate data provided to you in analysisSummary and answer the user's query accordingly. Add references from analysisResults from vector search and correlate actual entry content with analysis reponse that you provide!!

  MANDATORY: Only assert specific symptom words (e.g., "fatigue," "bloating," "heaviness") if those exact strings appear in the user's source text.If the data is theme-level (e.g., 'Body & Health' count) or inferred, phrase it as "Body & Health–related entries" instead of naming symptoms. Always include 1–3 reference snippets with dates when you claim any symptom is present in the entries. 
      
    MANDATORY:  For providing insights, patterns etc . : State the **specific numerical results** clearly backing your analysis; Proovide **contextual interpretation** (is this high/low/normal?); Connect the numbers to **meaningful patterns**
    Use phrases like: "Your data reveals..." "The analysis shows..." "Specifically, X% of your entries..."; Reference **specific themes and emotions** found ; Highlight **notable patterns or correlations** ; MUST!!! Include **sample insights** from the content when relevant; Connect findings to **personal growth opportunities** ; Quote anecdotes from qualifiable entries , eg. "You feel anxiety because of your recent startup issues"
      
    **CRITICAL CONTEXT ISOLATION RULES:**
    - IGNORE ALL previous assistant responses and analysis results from conversation context
    - Use ONLY the fresh COMPREHENSIVE ANALYSIS RESULTS as your factual basis
    - Do NOT reference, mention, or carry over ANY data, numbers, percentages, or topics from previous responses
    - If the current analysis results are about a completely different topic than the user's question, acknowledge this mismatch
    - Answer ONLY what the current analysis results support - do not fill gaps with conversation context
    - Previous conversation is for understanding user intent only, NOT for factual information
    
    **EMOTIONAL TONE GUIDANCE:**
    Look at the past conversation history provided to you and accordingly frame your response cleverly matching the user's emotional tone that's been running through up until now.
    
    **RESPONSE GUIDELINES:**
    Respond naturally in your authentic voice. Mandatorily use bold headers/words/sentences, paragraphs, structured responses, italics, bullets and compulsorily emojis. Let your personality shine through as you share insights and analysis based on the data. Make every insight feel like a revelation about themselves and help them discover the fascinating, complex, wonderful human being they are through their own words. Restric responses to less than 100 words unless question requires huge answers. Feel free to expand then!
    Brief responses requird under 120 words unless question desires more explanation and towards the end add followup questions by leveraging emotional tone of conversation history
      
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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-nano',
          messages: [
            { role: 'system', content: 'You are Ruh by SOuLO, a warm and insightful wellness coach. You analyze ONLY the current research results provided to you. Never reference or use data from previous conversations or responses.' },
            { role: 'user', content: consolidationPrompt }
          ],
          max_completion_tokens: 1500
        }),
    });

    // Handle non-OK responses gracefully
    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI Responses API error:', response.status, errText);
      const fallbackText = "I couldn't finalize your insight right now. Let's try again in a moment.";
      return new Response(JSON.stringify({
        success: true,
        response: fallbackText,
        userStatusMessage: null,
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
    // Sanitize and extract consolidated response
    const sanitized = sanitizeConsolidatorOutput(rawResponse);
    console.log(`[CONSOLIDATION SUCCESS] ${consolidationId}:`, {
      sanitizationMeta: sanitized.meta,
      responseLength: sanitized.responseText?.length || 0,
      hasStatusMessage: !!sanitized.statusMsg,
      responsePreview: sanitized.responseText?.substring(0, 150) || 'empty'
    });

    const consolidatedResponse = sanitized.responseText;
    const userStatusMessage = sanitized.statusMsg ?? null;

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
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
