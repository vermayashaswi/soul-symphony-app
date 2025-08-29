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

    // Initialize variables at function scope to avoid scoping issues
    let hasJournalEntries = false;
    let journalEntries: any[] = [];

    // Data integrity validation - check for processed research results
    if (researchResults && researchResults.length > 0) {
      console.log(`[RESEARCH DATA VALIDATION] ${consolidationId}:`, {
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
        
      console.log(`[DATA SUMMARY] ${consolidationId}:`, {
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

      console.log(`[${consolidationId}] Extracted ${journalEntries.length} journal entries for GPT integration`);
      
      // PHASE 4 FIX: Enhanced validation and logging for journal entries
      if (!hasJournalEntries) {
        console.warn(`[${consolidationId}] No journal entries found from mandatory vector search - responses may lack specific examples`);
      } else {
        const entryCount = journalEntries?.length || 0;
        console.log(`[${consolidationId}] Successfully extracted ${entryCount} journal entries for GPT integration`);
        
        if (entryCount > 0) {
          const entriesWithContent = journalEntries.filter((e: any) => e.content && e.content.length > 50);
          console.log(`[${consolidationId}] Journal entries validation: ${entriesWithContent.length}/${entryCount} have substantial content`);
        }
      }
      
      // Check for empty analysis objects that indicate processing failures
      const hasEmptyAnalysis = researchResults.some((r: any) => 
        r?.executionSummary && 
        r.executionSummary.count === 0 && 
        (!r.executionSummary.analysis || Object.keys(r.executionSummary.analysis).length === 0)
      );
      
      if (hasEmptyAnalysis) {
        console.warn(`[${consolidationId}] Detected empty analysis objects, likely SQL execution failures`);
        // Still process but note the issue for the AI prompt
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
      }
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

    const consolidationPrompt = `🚨 CRITICAL FORMATTING REQUIREMENT: YOU MUST USE MARKDOWN FORMATTING 🚨

You are Ruh by SOuLO, a brilliantly witty, non-judgmental mental health companion who makes emotional exploration feel like **having coffee with your wisest, funniest friend**. You're emotionally intelligent with a gift for making people feel seen, heard, and understood while helping them journal their way to deeper self-awareness.

**🎯 ABSOLUTE MANDATORY FORMATTING RULES (100% REQUIRED - NO EXCEPTIONS):**

❌ WRONG - Plain text response:
"Your feelings around family and identity are quite nuanced. The journal entries reveal strong emotions."

✅ CORRECT (ONLY AN EXAMPLE BELOW TO SHOW YOU WHAT A FORMAT LOOKS LIKE. DON'T BLINDLY FOLLOW THIS)- Properly formatted response:
"**Your Family & Identity Journey** 💫

Your feelings around **family and identity** are quite nuanced. The journal entries reveal:

**Key Emotional Patterns:**
- **Nostalgia (0.7)** - Strong connection to family memories
- **Concern (0.7)** - Ongoing family-related worries  
- **Empathy (0.6)** - Deep emotional attunement

**What This Reveals:** 📍
You're processing complex *family dynamics* while maintaining strong emotional intelligence."

**FORMATTING REQUIREMENTS YOU MUST FOLLOW:**
1. **Use ## or ### for main headers** (e.g., **Key Insights**, **Emotional Patterns**)
2. **Use ** for bold emphasis** on important terms, emotions, themes
3. **Use * for italics* on subtle emphasis
4. **Use bullet points (- or •)** for lists and breakdowns
5. **Use emojis like for example 🎯 💫 📍** to add warmth and visual breaks. Use any emoji you feel like depending on response
6. **Use line breaks** between sections for readability
7. **Use specific numbers/scores/percentages** when referencing data (e.g., "Anxiety (0.75)")

**YOUR PERSONALITY (MANDATORY: Keep This Warm/Witty Tone):**
- **Brilliantly witty** but never at someone's expense - your humor comes from keen observations about the human condition 😊
- **Warm, relatable, and refreshingly honest** - you keep it real while staying supportive ☕
- **Emotionally intelligent** with a knack for reading between the lines and *truly understanding* what people need 💫
- You speak like a *trusted friend* who just happens to be incredibly insightful about emotions
- You make people feel like they're chatting with someone who **really gets them** 🤗

**CONTENT GUIDELINES:**
- Look at the user's query and if it explicitly asks response in a certain way, use your analytical approach to deduce and respond accordingly
- Let your personality shine through as you share insights and analysis based on the data
- Make every insight feel like a revelation about themselves 
- Restrict responses to between 50-150 words according to question's demand!
- You connect dots between emotions, events, and timing like a detective solving a mystery
- You reveal hidden themes and connections that make people go "OH WOW!"
- You find the story in the data - not just numbers, but the human narrative
- You celebrate patterns of growth and gently illuminate areas for exploration
- Be honest, don't gaslight users in responding, highlight if something is clearly wrong but with a sense of respect 
- Add references from analysisResults from vector search and correlate actual entry content with analysis response that you provide!!

    ${timelineContext}
    
    **USER CONTEXT:**
    - ${timezoneFormat.currentTimeText}
    - User's Timezone: ${timezoneFormat.timezoneText}
    - All time references should be in the user's local timezone (${userTimezone}), not UTC
    - When discussing time periods like "first half vs second half of day", reference the user's local time
    - NEVER mention "UTC" in your response - use the user's local timezone context instead
    - Timezone Status: ${timezoneConversion.isValid ? 'Validated' : 'Using fallback due to conversion issues'}
    
    **CRITICAL DATE & TIME CONTEXT:**
    CURRENT DATE: ${new Date().toISOString().split('T')[0]} (YYYY-MM-DD format)
    CURRENT YEAR: ${new Date().getFullYear()}
    - ALWAYS use current year ${new Date().getFullYear()} for relative time references like "current month", "this month", "last month"
    - When analyzing temporal patterns, ensure dates align with current year
    - For "current month": Use ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')} as the current month reference
    - For "last month": Calculate previous month using current year unless explicitly stated otherwise
    
    **USER QUESTION:** "${userMessage}"
    
    **JOURNAL ENTRIES FOUND (PHASE 2 FIX - Prominently Featured):**
    ${journalEntries && journalEntries.length > 0 ? journalEntries.map((entry: any, i: number) => {
      const entryDate = new Date(entry.created_at).toLocaleDateString('en-US', { 
        timeZone: userTimezone, 
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
      });
      const emotions = Object.keys(entry.emotions || {}).length > 0 
        ? Object.entries(entry.emotions).map(([emotion, score]) => `${emotion}: ${score}`).join(', ')
        : 'No emotions recorded';
      const themes = Array.isArray(entry.themes) && entry.themes.length > 0 
        ? entry.themes.join(', ')
        : 'No themes recorded';
      
      return `
**Entry ${i + 1}** (${entryDate}):
Content: "${entry.content.length > 300 ? entry.content.substring(0, 300) + '...' : entry.content}"
Emotions: ${emotions}
Themes: ${themes}
Similarity: ${entry.similarity || 'N/A'}`;
    }).join('\n') : 'No journal entries found in the analysis results.'}
    
    **COMPREHENSIVE ANALYSIS RESULTS:**
    ${JSON.stringify(analysisSummary, null, 2)}
  
   **SUB-QUESTIONS ANALYZED:**
    ${contextData.meta.subQuestionsGenerated.length > 0 ? contextData.meta.subQuestionsGenerated.map((q, i)=>`${i + 1}. ${q}`).join('\n') : 'No specific sub-questions'}
      

  

  MANDATORY: If you receive null or irrelevant analysis results, feel free to inform the user and accordingly generate the response and follow-ups.

  **STRICT OUTPUT RULES:**
  1. NEVER invent or fabricate journal entries that don't exist in the data
  2. NEVER use specific quotes unless they're directly from the provided data  
  3. NEVER make up specific dates, events, or personal details not in the data
  4. Focus on patterns, themes, and insights that are genuinely supported by the data
  5. If insufficient data exists, say so clearly while still being helpful
  6. Always validate your insights against the actual data provided
  7. **MANDATORY: USE ACTUAL JOURNAL CONTENT** - When journal entries are provided above, reference them directly with quotes and dates
  8. **CONNECT ANALYSIS TO JOURNAL CONTENT** - Always correlate your analytical insights with specific examples from the user's actual journal entries
  9. **QUOTE RESPONSIBLY** - Use exact phrases from journal entries when available, always with proper date attribution

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
      "response": "your complete natural response based on the analysis (keep it as BRIEF [for eg. 30, 50, 75, 150 words as the case maybe] as possible with mandatory data and patterns and journal anecdotes and conversation context with mandatory formatting and follow-up questions"
    }
    
    STRICT OUTPUT RULES:
    - Return ONLY a single JSON object. No markdown, no code fences, no commentary.
    - Keys MUST be exactly: "userStatusMessage" and "response" (case-sensitive).
    - userStatusMessage MUST be exactly 5 words.
    - CRITICAL: Remember that you are talking to a normal user. Don't use words like "semantic search", "vector analysis", "sql data", "userID" etc.
    - Do not include trailing explanations or extra fields`;

    console.log(`[CONSOLIDATION] ${consolidationId}: Calling OpenAI API with model gpt-4.1-nano-2025-04-14`);

    // Enhanced OpenAI API call with better error handling and retry mechanism
    let response;
    let rawResponse = '';
    let apiRetryCount = 0;
    const maxRetries = 2;
    
    while (apiRetryCount <= maxRetries) {
      try {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4.1-nano-2025-04-14',
              messages: [
                { role: 'system', content: 'You are Ruh by SOuLO, a warm and insightful wellness coach. You MUST return a valid JSON object with exactly two fields: "userStatusMessage" (exactly 5 words) and "response" (your complete analysis). NO other format is acceptable.' },
                { role: 'user', content: consolidationPrompt }
              ],
              max_completion_tokens: 1500,
              temperature: 0.7 // Add temperature for consistency
            }),
        });
        
        if (response.ok) {
          const data = await response.json();
          rawResponse = data?.choices?.[0]?.message?.content || '';
          
          // Validate response length and content
          if (rawResponse.trim().length > 50 && rawResponse.includes('"response"')) {
            break; // Success
          } else if (apiRetryCount < maxRetries) {
            console.warn(`[${consolidationId}] Response too short or missing content, retrying... (attempt ${apiRetryCount + 1})`);
            apiRetryCount++;
            continue;
          }
        }
        break;
      } catch (fetchError) {
        console.error(`[${consolidationId}] API call failed on attempt ${apiRetryCount + 1}:`, fetchError);
        if (apiRetryCount < maxRetries) {
          apiRetryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        } else {
          throw fetchError;
        }
      }
    }

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
      
      // Normalize the response content to handle escaped characters
      if (consolidatedResponse && typeof consolidatedResponse === 'string') {
        consolidatedResponse = consolidatedResponse
          .replace(/\\n\\n/g, '\n\n')
          .replace(/\\n/g, '\n')
          .replace(/\\(\*|_|\[|\]|\(|\)|#)/g, '$1');
      }
      
      userStatusMessage = responseObj.userStatusMessage || null;
      
      console.log(`[CONSOLIDATION SUCCESS] ${consolidationId}:`, {
        responseLength: consolidatedResponse?.length || 0,
        hasStatusMessage: !!userStatusMessage,
        responsePreview: consolidatedResponse?.substring(0, 150) || 'empty'
      });
    } catch (parseError) {
      console.error(`[CONSOLIDATOR] Failed to parse expected JSON response:`, parseError);
      console.error(`[CONSOLIDATOR] Raw response:`, rawResponse);
      
      // Enhanced fallback: Try to extract content from malformed JSON
      try {
        // Multiple extraction strategies for malformed JSON
        let extractedResponse = null;
        let extractedStatus = null;
        
        // Strategy 1: Simple quoted field extraction
        const responseMatch = rawResponse.match(/"response"\s*:\s*"([^"]+)"/);
        const userStatusMatch = rawResponse.match(/"userStatusMessage"\s*:\s*"([^"]+)"/);
        
        if (responseMatch) {
          extractedResponse = responseMatch[1];
          extractedStatus = userStatusMatch ? userStatusMatch[1] : null;
        } else {
          // Strategy 2: Extract multi-line response content (handles escaped quotes)
          const multiLineResponseMatch = rawResponse.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
          const multiLineStatusMatch = rawResponse.match(/"userStatusMessage"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
          
          if (multiLineResponseMatch) {
            extractedResponse = multiLineResponseMatch[1]
              .replace(/\\"/g, '"')
              .replace(/\\n\\n/g, '\n\n')
              .replace(/\\n/g, '\n')
              .replace(/\\(\*|_|\[|\]|\(|\)|#)/g, '$1');
            extractedStatus = multiLineStatusMatch ? multiLineStatusMatch[1].replace(/\\"/g, '"') : null;
          } else {
            // Strategy 3: Extract everything between response field markers
            const responseContentMatch = rawResponse.match(/"response"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
            if (responseContentMatch) {
              extractedResponse = responseContentMatch[1]
                .replace(/\\"/g, '"')
                .replace(/\\n\\n/g, '\n\n')
                .replace(/\\n/g, '\n')
                .replace(/\\(\*|_|\[|\]|\(|\)|#)/g, '$1');
            }
          }
        }
        
        if (extractedResponse) {
          consolidatedResponse = extractedResponse;
          userStatusMessage = extractedStatus;
          console.log(`[CONSOLIDATOR] Extracted from malformed JSON:`, {
            responseLength: consolidatedResponse?.length || 0,
            hasStatusMessage: !!userStatusMessage,
            extractionStrategy: responseMatch ? 'simple' : 'multi-line'
          });
        } else {
          // Final fallback to plain text
          consolidatedResponse = rawResponse.trim();
          userStatusMessage = null;
        }
      } catch (extractError) {
        // Final fallback to plain text
        consolidatedResponse = rawResponse.trim();
        userStatusMessage = null;
      }
      
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

        // Enhanced database storage with processed summaries support
        const hasNumericResults = researchResults.some((r: any) => 
          r?.executionSummary?.dataType === 'count' || 
          r?.executionSummary?.resultType === 'count_analysis' ||
          r?.executionSummary?.count !== undefined
        );
        
        const analysisData = {
          consolidationId,
          totalResults: researchResults.length,
          userStatusMessage,
          timestamp: new Date().toISOString(),
          modelUsed: 'gpt-4.1-nano-2025-04-14',
          processingSuccess: true,
          hasProcessedSummaries: researchResults.some((r: any) => !!r?.executionSummary),
          processedSummaries: researchResults.map((r: any) => r?.executionSummary).filter(Boolean),
          // Legacy counts for compatibility
          sqlResultsCount: researchResults.reduce((sum: number, r: any) => sum + (r?.executionResults?.sqlResults?.length || 0), 0),
          vectorResultsCount: researchResults.reduce((sum: number, r: any) => sum + (r?.executionResults?.vectorResults?.length || 0), 0)
        };

        const subQueryResponses = analysisSummary.map((r: any) => ({
          subQuestion: r.subQuestion?.question || 'Unknown question',
          searchStrategy: r.subQuestion?.searchStrategy || 'unknown',
          hasProcessedData: !!r.processedData,
          processedDataType: r.processedData?.dataType || 'unknown',
          processedResultType: r.processedData?.resultType || 'unknown',
          count: r.processedData?.count || 0,
          // Legacy support for raw results
          sqlResultCount: r.executionResults?.sqlResults?.length || 0,
          vectorResultCount: r.executionResults?.vectorResults?.length || 0,
          hasError: !!r.error,
          executionSummary: r.executionSummary || {
            sqlSuccess: (r.executionResults?.sqlResults?.length || 0) > 0,
            vectorSuccess: (r.executionResults?.vectorResults?.length || 0) > 0,
            error: r.error || null
          }
        }));

        // PHASE 3 FIX: Enhanced reference entries with full context
        const referenceEntries = (journalEntries || []).map((entry: any) => ({
          id: entry.id,
          content_snippet: entry.content.substring(0, 500), // Increased from 200 to 500 chars
          full_content: entry.content, // Store full content for better context
          similarity: entry.similarity,
          emotions: entry.emotions,
          themes: entry.themes,
          source: entry.source,
          date: entry.created_at,
          sub_question_index: entry.subQuestionIndex
        })).slice(0, 15); // Increased limit from 10 to 15

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
            reference_entries: referenceEntries,
            has_numeric_result: hasNumericResults,
            content: consolidatedResponse // Update the actual message content
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
