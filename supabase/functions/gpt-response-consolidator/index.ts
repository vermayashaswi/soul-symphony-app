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
      return { responseText: 'I ran into a formatting issue preparing your insights. Let’s try again.', statusMsg: null, meta };
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
          parsed = JSON.parse(jsonStr);
          meta.parsedExtracted = true;
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
    const { 
      userMessage, 
      analysisResults, 
      conversationContext, 
      userProfile,
      streamingMode = false,
      messageId 
    } = await req.json();
    
    console.log('GPT Response Consolidator called with:', { 
      userMessage: userMessage?.substring(0, 100),
      analysisResultsCount: analysisResults?.length || 0,
      contextCount: conversationContext?.length || 0,
      streamingMode,
      messageId
    });

    // Enhanced analysis summary for GPT with detailed quantitative insights
    const analysisSummary = analysisResults.map((result: any, index: number) => {
      const summary = {
        subQuestion: result.subQuestion.question,
        type: result.subQuestion.type,
        strategy: result.analysisPlan?.searchStrategy || result.analysisPlan?.query_type,
        reasoning: result.analysisPlan?.reasoning,
        quantitativeFindings: {},
        qualitativeFindings: {},
        error: result.error
      };

      // Enhanced processing of SQL calculation results
      if (result.sqlResults && typeof result.sqlResults === 'object') {
        if ('percentage' in result.sqlResults) {
          summary.quantitativeFindings = {
            type: 'percentage_analysis',
            percentage: result.sqlResults.percentage,
            subset: result.sqlResults.filteredCount,
            total: result.sqlResults.totalCount,
            interpretation: result.sqlResults.percentage >= 50 ? 'majority_presence' : 'minority_presence',
            significance: result.sqlResults.percentage > 75 ? 'very_high' : 
                        result.sqlResults.percentage > 50 ? 'high' :
                        result.sqlResults.percentage > 25 ? 'moderate' : 'low'
          };
        } else if ('count' in result.sqlResults) {
          summary.quantitativeFindings = {
            type: 'count_analysis',
            count: result.sqlResults.count,
            magnitude: result.sqlResults.count > 50 ? 'extensive' :
                     result.sqlResults.count > 20 ? 'substantial' :
                     result.sqlResults.count > 10 ? 'moderate' : 'limited'
          };
        }
      }

      // Enhanced vector search insights
      if (result.vectorResults && result.vectorResults.length > 0) {
        summary.qualitativeFindings = {
          type: 'semantic_insights',
          entryCount: result.vectorResults.length,
          sampleEntries: result.vectorResults.slice(0, 2).map((entry: any) => ({
            date: entry.created_at,
            contentPreview: entry.content?.substring(0, 150),
            similarity: Math.round(entry.similarity * 100),
            topEmotions: entry.emotions ? Object.entries(entry.emotions)
              .sort(([,a], [,b]) => (b as number) - (a as number))
              .slice(0, 3)
              .map(([emotion, score]) => `${emotion}: ${(score as number * 100).toFixed(0)}%`)
              : []
          })),
          avgSimilarity: Math.round(result.vectorResults.reduce((sum: number, entry: any) => sum + entry.similarity, 0) / result.vectorResults.length * 100)
        };
      }

      return summary;
    }).filter(s => s.quantitativeFindings.type || s.qualitativeFindings.type || s.error);

    // Build comprehensive context for GPT
    const contextData = {
      userProfile: {
        timezone: userProfile?.timezone || 'UTC',
        journalEntryCount: userProfile?.journalEntryCount || 'unknown',
        premiumUser: userProfile?.is_premium || false
      },
      conversationHistory: conversationContext?.slice(-6) || [], // Last 6 messages for context
      analysis: analysisSummary
    };

    const consolidationPrompt = `
    You are Ruh by SOuLO, an analytical wellness coach specializing in data-driven insights from journal analysis. You transform complex data into meaningful, actionable insights.
    
    **USER QUESTION:** "${userMessage}"
    
    **COMPREHENSIVE ANALYSIS RESULTS:**
    ${JSON.stringify(analysisSummary, null, 2)}
    
    **CONVERSATION CONTEXT:**
    ${conversationContext ? conversationContext.slice(-6).map((msg: any) => `${(msg.role || msg.sender || 'user')}: ${msg.content}`).join('\n') : 'No prior context'}
    
    **ANALYSIS SYNTHESIS GUIDELINES:**
    
    **For Quantitative Findings (percentages, counts, calculations):**
    - State the **specific numerical results** clearly
    - Provide **contextual interpretation** (is this high/low/normal?)
    - Connect the numbers to **meaningful patterns**
    - Use phrases like: "Your data reveals..." "The analysis shows..." "Specifically, X% of your entries..."
    
    **For Qualitative Insights (semantic content analysis):**
    - Reference **specific themes and emotions** found
    - Highlight **notable patterns or correlations**
    - Include **sample insights** from the content when relevant
    - Connect findings to **personal growth opportunities**
    
    **Communication Style:**
    - **Professional yet warm** 🌟
    - **Data-focused but human-centered** 📊
    - **Specific rather than vague** 🎯
    - **Insightful and actionable** 💡
    
    **Response Structure:**
    1. **Lead with the key finding** (the answer to their question)
    2. **Provide supporting data details** (percentages, patterns, specifics)
    3. **Offer interpretation and context** (what this means for them)
    4. **Suggest next steps or follow-up questions**
    
    **Mandatory Requirements:**
    - Always include **specific numbers/percentages** when available
    - Reference **actual data points** from the analysis
    - Use **bold** for key insights and **italics** for reflective observations
    - End with **1-2 thoughtful follow-up questions**
    
    Your response should be a JSON object with this structure:
    {
      "userStatusMessage": "exactly 5 words describing your synthesis approach (e.g., 'Revealing your hidden emotional patterns' or 'Connecting insights to personal growth')",
      "response": "your complete natural response based on the analysis and conversation context with mandatory formatting and follow-up questions"
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
          model: 'gpt-4.1-2025-04-14',
          messages: [
            { role: 'system', content: 'You are Ruh by SOuLO, a warm and insightful wellness coach. Provide thoughtful, data-driven responses based on journal analysis.' },
            { role: 'user', content: consolidationPrompt }
          ],
          max_tokens: 1500
        }),
    });

    // Handle non-OK responses gracefully
    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI Responses API error:', response.status, errText);
      const fallbackText = "I couldn’t finalize your insight right now. Let’s try again in a moment.";
      return new Response(JSON.stringify({
        success: true,
        response: fallbackText,
        userStatusMessage: null,
        analysisMetadata: {
          totalSubQuestions: analysisResults.length,
          strategiesUsed: analysisResults.map((r: any) => r.analysisPlan?.searchStrategy),
          dataSourcesUsed: {
            vectorSearch: analysisResults.some((r: any) => r.vectorResults),
            sqlQueries: analysisResults.some((r: any) => r.sqlResults),
            errors: analysisResults.some((r: any) => r.error)
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
    console.log('Consolidator sanitization meta:', sanitized.meta);

    const consolidatedResponse = sanitized.responseText;
    const userStatusMessage = sanitized.statusMsg ?? null;

    return new Response(JSON.stringify({
      success: true,
      response: consolidatedResponse,
      userStatusMessage,
      analysisMetadata: {
        totalSubQuestions: analysisResults.length,
        strategiesUsed: analysisResults.map((r: any) => r.analysisPlan?.searchStrategy),
        dataSourcesUsed: {
          vectorSearch: analysisResults.some((r: any) => r.vectorResults),
          sqlQueries: analysisResults.some((r: any) => r.sqlResults),
          errors: analysisResults.some((r: any) => r.error)
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