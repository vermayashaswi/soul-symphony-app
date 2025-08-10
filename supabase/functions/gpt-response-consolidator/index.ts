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
      researchResults, 
      conversationContext, 
      userProfile,
      streamingMode = false,
      messageId 
    } = await req.json();
    
    console.log('GPT Response Consolidator called with:', { 
      userMessage: userMessage?.substring(0, 100),
      researchResultsCount: researchResults?.length || 0,
      contextCount: conversationContext?.length || 0,
      streamingMode,
      messageId
    });

    // Process Researcher Agent results into consolidated insights
    const analysisSummary = researchResults.map((research: any, index: number) => {
      const summary = {
        subQuestion: research.subQuestion.question,
        purpose: research.subQuestion.purpose,
        searchStrategy: research.researcherOutput?.validatedPlan?.searchStrategy,
        researcherValidation: {
          confidence: research.researcherOutput?.confidence,
          validationIssues: research.researcherOutput?.validationIssues || [],
          enhancements: research.researcherOutput?.enhancements || []
        },
        quantitativeFindings: {},
        qualitativeFindings: {},
        error: research.executionResults?.error
      };

      // Process SQL results from execution
      if (research.executionResults?.sqlResults && Array.isArray(research.executionResults.sqlResults)) {
        const sqlData = research.executionResults.sqlResults;
        
        if (sqlData.length > 0) {
          const firstRow = sqlData[0];
          
          // Handle percentage calculations
          if ('percentage' in firstRow) {
            summary.quantitativeFindings = {
              type: 'percentage_analysis',
              percentage: firstRow.percentage,
              count: firstRow.count || sqlData.length,
              interpretation: firstRow.percentage >= 50 ? 'majority_presence' : 'minority_presence',
              significance: firstRow.percentage > 75 ? 'very_high' : 
                          firstRow.percentage > 50 ? 'high' :
                          firstRow.percentage > 25 ? 'moderate' : 'low'
            };
          }
          // Handle count data
          else if ('count' in firstRow || 'frequency' in firstRow) {
            const countValue = firstRow.count || firstRow.frequency || sqlData.length;
            summary.quantitativeFindings = {
              type: 'count_analysis',
              count: countValue,
              data: sqlData.slice(0, 5), // Top 5 results
              magnitude: countValue > 50 ? 'extensive' :
                        countValue > 20 ? 'substantial' :
                        countValue > 10 ? 'moderate' : 'limited'
            };
          }
          // Handle average/score data
          else if ('avg_score' in firstRow || 'score' in firstRow) {
            summary.quantitativeFindings = {
              type: 'score_analysis',
              topResults: sqlData.slice(0, 5),
              avgScore: firstRow.avg_score || firstRow.score,
              dataPoints: sqlData.length
            };
          }
        }
      }

      // Process vector search results
      if (research.executionResults?.vectorResults && research.executionResults.vectorResults.length > 0) {
        const vectorData = research.executionResults.vectorResults;
        summary.qualitativeFindings = {
          type: 'semantic_insights',
          entryCount: vectorData.length,
          sampleEntries: vectorData.slice(0, 2).map((entry: any) => ({
            date: entry.created_at,
            contentPreview: entry.content?.substring(0, 150),
            similarity: Math.round((entry.similarity || 0) * 100),
            themes: entry.themes || [],
            topEmotions: entry.emotions ? Object.entries(entry.emotions)
              .sort(([,a], [,b]) => (b as number) - (a as number))
              .slice(0, 3)
              .map(([emotion, score]) => `${emotion}: ${(score as number * 100).toFixed(0)}%`)
              : []
          })),
          avgSimilarity: Math.round(vectorData.reduce((sum: number, entry: any) => sum + (entry.similarity || 0), 0) / vectorData.length * 100)
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
    console.log('Consolidator sanitization meta:', sanitized.meta);

    const consolidatedResponse = sanitized.responseText;
    const userStatusMessage = sanitized.statusMsg ?? null;

    return new Response(JSON.stringify({
      success: true,
      response: consolidatedResponse,
      userStatusMessage,
      analysisMetadata: {
        totalSubQuestions: researchResults.length,
        strategiesUsed: researchResults.map((r: any) => r.researcherOutput?.validatedPlan?.searchStrategy),
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