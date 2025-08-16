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

    // Enhanced data validation - check for content availability
    if (researchResults && researchResults.length > 0) {
      console.log(`[RESEARCH DATA VALIDATION] ${consolidationId}:`, {
        totalResults: researchResults.length,
        resultTypes: researchResults.map((r: any, i: number) => ({
          index: i,
          question: r?.subQuestion?.question?.substring(0, 50) || 'unknown',
          sqlRowCount: r?.executionResults?.sqlResults?.length || 0,
          vectorResultCount: r?.executionResults?.vectorResults?.length || 0,
          hasError: !!r?.executionResults?.error,
          hasContentSamples: r?.executionResults?.vectorResults?.some((v: any) => v?.content || v?.["refined text"] || v?.["transcription text"]) || false,
          sampleSqlData: r?.executionResults?.sqlResults?.slice(0, 1) || null
        }))
      });
      
      // Check for potential data contamination indicators
      const totalSqlRows = researchResults.reduce((sum: number, r: any) => 
        sum + (r?.executionResults?.sqlResults?.length || 0), 0);
      const totalVectorResults = researchResults.reduce((sum: number, r: any) => 
        sum + (r?.executionResults?.vectorResults?.length || 0), 0);
      const hasContentExamples = researchResults.some((r: any) => 
        r?.executionResults?.vectorResults?.some((v: any) => 
          v?.content || v?.["refined text"] || v?.["transcription text"]));
        
      console.log(`[DATA SUMMARY] ${consolidationId}:`, {
        totalSqlRows,
        totalVectorResults,
        hasContentExamples,
        userQuestion: userMessage,
        potentialStaleDataRisk: totalSqlRows > 0 ? 'check_sql_dates' : 'no_sql_data'
      });
    }

    // Enhanced payload processing to include content examples
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

      // Enhanced vector results processing to preserve content
      const processedVectorResults = originalVector ? originalVector.slice(0, MAX_VECTOR_ITEMS).map((item: any) => ({
        ...item,
        contentPreview: item?.content?.substring(0, 300) || 
                       item?.["refined text"]?.substring(0, 300) || 
                       item?.["transcription text"]?.substring(0, 300) || 
                       'No content available',
        hasContent: !!(item?.content || item?.["refined text"] || item?.["transcription text"]),
        created_at: item?.created_at,
        themes: item?.master_themes || item?.themes || [],
        emotions: item?.emotions || {}
      })) : null;

      return {
        subQuestion: research?.subQuestion ?? null,
        researcherOutput: research?.researcherOutput ?? null,
        executionResults: {
          ...(research?.executionResults ?? {}),
          sqlResults: originalSql ? originalSql.slice(0, MAX_SQL_ROWS) : originalSql,
          sqlRowCount: originalSql?.length ?? 0,
          sqlRowCappedTo: sqlTrimmed ? MAX_SQL_ROWS : (originalSql?.length ?? 0),
          vectorResults: processedVectorResults,
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

    // Build lightweight context snapshot
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

    const consolidationPrompt = `
    You are Ruh by SOuLO, an analytical wellness coach specializing in data-driven insights from journal analysis. You transform complex data into meaningful, actionable insights with specific examples from the user's actual journal entries.
    
    **USER QUESTION:** "${userMessage}"
    
    **COMPREHENSIVE ANALYSIS RESULTS:**
    ${JSON.stringify(analysisSummary, null, 2)}
    
    **FOCUS GUARDRAILS:**
    - Use ONLY the COMPREHENSIVE ANALYSIS RESULTS above as your factual basis
    - Answer the exact USER QUESTION based solely on the fresh analysis data
    - If analysis results don't match the question, acknowledge this clearly
    - CRITICAL: Verify that the data you're analyzing actually corresponds to the user's question timeframe
    - If you detect data inconsistencies or mismatches, flag this immediately
    
    **ENHANCED ANALYSIS SYNTHESIS GUIDELINES:**
    
    **For Content-Specific Insights (PRIORITY - Include Specific Examples):**
    - **Reference actual journal entry content** from the vectorResults when available
    - **Quote specific topics, subjects, or themes** the user discussed
    - **Include concrete examples** like "You recently wrote about modern parenting challenges" or "You mentioned your fitness routine showing good results"
    - **Use contentPreview fields** from vector search results to provide specific examples
    - **Combine statistical insights with real content references**
    
    **For Quantitative Findings (percentages, counts, calculations):**
    - State the **specific numerical results** clearly
    - Provide **contextual interpretation** (is this high/low/normal?)
    - Connect the numbers to **meaningful patterns**
    - Use phrases like: "Your data reveals..." "The analysis shows..." "Specifically, X% of your entries..."
    
    **For Qualitative Insights (semantic content analysis):**
    - Reference **specific themes and emotions** found
    - Highlight **notable patterns or correlations**
    - Include **sample insights** from the actual journal content when available
    - **Quote or paraphrase specific topics** the user discussed
    - Connect findings to **personal growth opportunities**
    
    **ENHANCED Communication Style:**
    - **Professional yet warm** 🌟
    - **Content-focused and personalized** - reference what they actually wrote about
    - **Specific rather than vague** 🎯 - mention actual topics discussed
    - **Insightful and actionable** 💡
    - **Must include 1-3 relevant emojis** throughout the response to enhance engagement
    
    **Enhanced Response Structure:**
    1. **Lead with the key finding** (the answer to their question)
    2. **Provide specific content examples** (what they actually wrote about)
    3. **Include supporting statistical data** (percentages, patterns, specifics)
    4. **Offer interpretation and context** (what this means for them)
    5. **Suggest next steps or follow-up questions**
    
    **Mandatory Requirements:**
    - **PRIORITY**: Include specific examples from their actual journal entries when vector search results are available
    - Always include **specific numbers/percentages** when available
    - Reference **actual data points** from the analysis
    - **Quote or reference specific topics** they discussed (e.g., "parenting", "fitness", "work challenges")
    - Use **bold** for key insights and **italics** for reflective observations
    - **Include 1-3 relevant emojis** throughout the response (mandatory)
    - End with **1-2 thoughtful follow-up questions**
    
    **Example of Enhanced Response Style:**
    Instead of: "Your entries show Mental Health as a top theme"
    Use: "Your entries reveal Mental Health as a dominant theme (appearing in 14 entries), and looking at your actual writings, you've been discussing things like modern parenting challenges and how your fitness routine is showing good results 💪"
    
    Your response should be a JSON object with this structure:
    {
      "userStatusMessage": "exactly 5 words describing your synthesis approach that emphasizes content analysis",
      "response": "your complete natural response based on both statistical analysis AND specific journal content examples with mandatory formatting and follow-up questions"
    }
    
    STRICT OUTPUT RULES:
    - Return ONLY a single JSON object. No markdown, no code fences, no commentary.
    - Keys MUST be exactly: "userStatusMessage" and "response" (case-sensitive).
    - userStatusMessage MUST be exactly 5 words.
    - Do not include trailing explanations or extra fields.
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are Ruh by SOuLO, a warm and insightful wellness coach. You analyze ONLY the current research results provided to you, including both statistical data AND specific journal content examples when available. Never reference or use data from previous conversations or responses.' },
            { role: 'user', content: consolidationPrompt }
          ],
          max_tokens: 1800
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
