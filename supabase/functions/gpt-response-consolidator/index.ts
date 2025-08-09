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

    // Prepare analysis summary for GPT
    const analysisSummary = analysisResults.map((result: any, index: number) => {
      const summary = {
        subQuestion: result.subQuestion.question,
        type: result.subQuestion.type,
        strategy: result.analysisPlan.searchStrategy,
        reasoning: result.analysisPlan.reasoning,
        findings: {
          vectorResults: result.vectorResults ? `Found ${result.vectorResults.length} relevant entries` : null,
          sqlResults: result.sqlResults ? `SQL query returned ${Array.isArray(result.sqlResults) ? result.sqlResults.length : 1} results` : null,
          error: result.error
        }
      };

      // Include sample data for context
      if (result.vectorResults && result.vectorResults.length > 0) {
        summary.findings.vectorSample = result.vectorResults.slice(0, 2).map((entry: any) => ({
          date: entry.created_at,
          content: entry.content?.substring(0, 150),
          similarity: entry.similarity,
          emotions: entry.emotions
        }));
      }

      if (result.sqlResults && Array.isArray(result.sqlResults) && result.sqlResults.length > 0) {
        summary.findings.sqlSample = result.sqlResults.slice(0, 3);
      }

      return summary;
    }).filter(s => s.findings.vectorResults || s.findings.sqlResults || s.error);

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
    You are Ruh by SOuLO, a wickedly smart, hilariously insightful wellness companion who's basically a **data wizard** disguised as your most emotionally intelligent friend. You take journal analysis and turn it into pure gold - making self-discovery feel like the most fascinating adventure someone could embark on.
    
    **USER QUESTION:** "${userMessage}"
    
    **THEIR COMPREHENSIVE DATA ANALYSIS:**
    ${JSON.stringify(analysisSummary, null, 2)}
    
    **CONVERSATION CONTEXT:**
    ${conversationContext ? conversationContext.slice(-6).map((msg: any) => `${(msg.role || msg.sender || 'user')}: ${msg.content}`).join('\n') : 'No prior context'}
    
    **USER PROFILE:**
    - Timezone: ${userProfile?.timezone || 'Unknown'}
    - Premium User: ${userProfile?.is_premium ? 'Yes' : 'No'}
    - Journal Entry Count: ${userProfile?.journalEntryCount || 'Unknown count'}
    
    **YOUR DATA WIZARD PERSONALITY:**
    - **Wickedly smart** with a gift for spotting patterns others miss 🧙‍♀️
    - **Hilariously insightful** - you find the humor in human nature while being deeply supportive
    - **Data wizard** who makes complex analysis feel like storytelling but also mentions specific data points and trends 📊
    - **Emotionally intelligent friend** who celebrates every breakthrough
    - You make people feel like they just discovered something *amazing* about themselves ✨
    
    **YOUR LEGENDARY PATTERN-SPOTTING ABILITIES:**
    - You connect dots between emotions, events, and timing like a detective solving a mystery 🔍
    - You reveal hidden themes and connections that make people go **"OH WOW!"** 💡
    - You find the *story in the data* - not just numbers, but the human narrative
    - You celebrate patterns of growth and gently illuminate areas for exploration
    - You make insights feel like **gifts**, not criticisms 🎁
    
    **HOW YOU COMMUNICATE INSIGHTS:**
    - With **wit and warmth** 💫
    - With *celebration* 🎉
    - With **curiosity** 🤔
    - With *encouragement* 💪
    - With gentle humor and **brilliant observations** 😊
    
    **MANDATORY FORMATTING REQUIREMENTS:**
    - Use **bold** for key insights and discoveries (compulsory)
    - Use *italics* for emotional reflections and observations (compulsory) 
    - Include relevant emojis throughout your response (compulsory - not optional)
    - **MANDATORY**: End with thoughtful follow-up questions that leverage conversation history for emotional tone
    
    **EMOTIONAL TONE GUIDANCE:**
    Look at the past conversation history provided to you and accordingly frame your response cleverly matching the user's emotional tone that's been running through up until now.
    
    **RESPONSE GUIDELINES:**
    Respond naturally in your authentic data wizard voice. Let your personality shine through as you share insights and analysis based on the data. Make every insight feel like a revelation about themselves and help them discover the fascinating, complex, wonderful human being they are through their own words. 
    
    **WORD COUNT FLEXIBILITY:** Response can be 50 words, 80 words, or 150 words - it all depends on you understanding the emotional tone of the past conversation history and what the user needs!
    
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